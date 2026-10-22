import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Device from 'expo-device';

import { api, ApiError, loadToken, setSignedOutHandler } from '@/core/api/client';
import type { User } from '@/core/api/types';
import { startSync, stopSync } from '@/core/sync/engine';
import { storage } from '@/core/storage';

type Session = {
  user: User | null;
  ready: boolean;
  signIn: (login: string, password: string) => Promise<void>;
  register: (fields: { username: string; name: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);
const deviceName = () => [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'Phone';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signedIn = useCallback((next: User) => {
    setUser(next);
    storage.set('user', next);
    void startSync();
  }, []);

  // The server no longer accepts the saved sign-in: unsent progress is kept for the next sign-in.
  const signedOut = useCallback(() => {
    setUser(null);
    storage.remove('user');
    void stopSync({ forget: false });
  }, []);

  useEffect(() => {
    setSignedOutHandler(signedOut);
    (async () => {
      if (await loadToken()) {
        // Offline the saved user stands in; the server confirms the sign-in when it can be reached.
        const saved = await storage.get<User | null>('user', null);
        if (saved) signedIn(saved);
        try {
          const { user: current } = await api.me();
          if (current) signedIn(current);
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
        }
      }
      setReady(true);
    })();
    return () => setSignedOutHandler(null);
  }, [signedIn, signedOut]);

  const value = useMemo<Session>(
    () => ({
      user,
      ready,
      signIn: async (login, password) => signedIn(await api.signIn(login, password, deviceName())),
      register: async fields => signedIn(await api.register(fields, deviceName())),
      signOut: async () => {
        // Send what is waiting while the sign-in still works, then sign this device out.
        await stopSync({ forget: true });
        try {
          await api.signOut();
        } finally {
          setUser(null);
          storage.remove('user');
        }
      },
    }),
    [user, ready, signedIn],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}
