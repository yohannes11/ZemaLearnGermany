import * as SecureStore from 'expo-secure-store';

import { apiUrl } from '@/core/config';

import type { Op, SyncState } from '@/core/sync/rules';

import type { ApiIndex, CourseBundle, User, WhyGerman } from './types';

const TOKEN_KEY = 'zema.token';
const TIMEOUT_MS = 20_000;

/** A request the server answered with an error, or that never reached it (`status` 0). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
  get offline() {
    return this.status === 0;
  }
}

let token: string | null = null;
let onSignedOut: (() => void) | null = null;

/** The saved sign-in, for the live connection (it signs in with the token in its first message). */
export const currentToken = () => token;

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}

async function saveToken(value: string | null) {
  token = value;
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Called when the server no longer accepts the saved sign-in (password changed, device removed by an admin). */
export function setSignedOutHandler(handler: (() => void) | null) {
  onSignedOut = handler;
}

type Options = { method?: string; body?: unknown; headers?: Record<string, string> };

/** A JSON request to /api/v1/<path>, signed with the saved token. Returns the raw response for 304 handling. */
export async function request(path: string, { method = 'GET', body, headers = {} }: Options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}/api/v1/${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No connection to the server.', 0);
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 && token) {
    await saveToken(null);
    onSignedOut?.();
  }
  if (!response.ok && response.status !== 304) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error ?? `The server answered ${response.status}.`, response.status);
  }
  return response;
}

async function json<T>(path: string, options?: Options): Promise<T> {
  return (await request(path, options)).json();
}

export type Snapshot = Omit<SyncState, 'wordLog' | 'sessionStamp'>;

export const api = {
  index: () => json<ApiIndex>(''),

  /** The course, or null when `version` is still current (the server answers 304). */
  async course(lang: string, version?: string): Promise<CourseBundle | null> {
    const response = await request(`course/?lang=${lang}`, {
      headers: version ? { 'If-None-Match': `"${version}"` } : {},
    });
    return response.status === 304 ? null : response.json();
  },

  async signIn(login: string, password: string, device: string) {
    const data = await json<{ user: User; token: string }>('auth/token/', { method: 'POST', body: { login, password, device } });
    await saveToken(data.token);
    return data.user;
  },

  async register(fields: { username: string; name: string; email: string; password: string }, device: string) {
    const data = await json<{ user: User; token: string }>('auth/register/', { method: 'POST', body: { ...fields, device } });
    await saveToken(data.token);
    return data.user;
  },

  async signOut() {
    try {
      await request('auth/token/', { method: 'DELETE' });
    } finally {
      await saveToken(null);
    }
  },

  me: () => json<{ user: User | null }>('auth/me/'),

  whyGerman: (lang: string) => json<WhyGerman>(`why-german/?lang=${lang}`),

  /** The account's whole state (see core/sync). */
  getSync: () => json<Snapshot>('sync/'),

  /** Sends operations (each applied once on the server) and gets the resulting state, with every device's changes. */
  postSync: (ops: Op[], device: string) => json<Snapshot>('sync/', { method: 'POST', body: { ops, device } }),

  /** A link that opens the website signed in as the same learner (works once, for two minutes). */
  webSessionLink: (next = '/learn/') =>
    json<{ url: string }>(`auth/web-session/?next=${encodeURIComponent(next)}`, { method: 'POST' }),
};
