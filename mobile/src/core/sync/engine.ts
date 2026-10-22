import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { useSyncExternalStore } from 'react';

import { api, ApiError, type Snapshot } from '@/core/api/client';
import { storage } from '@/core/storage';

import { connectLive, disconnectLive } from './live';
import { applyAll, emptyState, type Op, type Session, type SyncState } from './rules';

/**
 * The sync engine. The app records what the learner does as operations (rules.ts); what it shows is the server's
 * last state with the operations it hasn't confirmed yet applied on top, so every change appears at once, offline
 * too. Operations wait in a persisted outbox and are sent when signed in and online: right after a change (a
 * short pause gathers several), when the app comes back to the front, when the network returns, and when the
 * live connection says another device changed something. The server applies each operation once, so sending
 * again after a failure is always safe.
 */

type Persisted = { snapshot: Snapshot | null; outbox: Op[]; device: string; lastSync: number | null };
export type SyncStatus = { pending: number; lastSync: number | null; online: boolean; syncing: boolean };

const FLUSH_DELAY_MS = 800;
const BATCH = 500;
const MAX_OUTBOX = 5000;
const RETRY_MS = [5_000, 15_000, 30_000, 60_000];

let persisted: Persisted = { snapshot: null, outbox: [], device: '', lastSync: null };
let state: SyncState = emptyState();
let status: SyncStatus = { pending: 0, lastSync: null, online: true, syncing: false };
let signedIn = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let retry = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const contentListeners = new Set<() => void>();

const platform = Platform.OS === 'ios' ? 'ios' : 'android';
const id = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function recompute() {
  const base: SyncState = persisted.snapshot ? { ...emptyState(), ...persisted.snapshot } : emptyState();
  state = applyAll(base, persisted.outbox);
  status = { ...status, pending: persisted.outbox.length, lastSync: persisted.lastSync };
  listeners.forEach(listener => listener());
}

function save() {
  void storage.set('sync', persisted);
}

function schedule(delay = FLUSH_DELAY_MS) {
  if (timer) clearTimeout(timer);
  if (signedIn && persisted.outbox.length) timer = setTimeout(() => void flush(), delay);
}

/**
 * Progress saved by app versions before operations ("progress" and "srs"), as operations: it then reaches the
 * account and merges like anything else. Days keep their XP; words and reviews get today's date.
 */
async function migrateOldProgress(): Promise<Op[]> {
  type Old = { learned?: string[]; grammar?: Record<string, number>; xp?: Record<string, number> };
  const old = await storage.get<Old | null>('progress', null);
  const oldReviews = await storage.get<{ words?: Record<string, { box: number; due: string }> } | null>('srs', null);
  if (!old && !oldReviews) return [];
  const at = Date.now();
  const day = dayKey();
  const ops: Op[] = [];
  for (const german of old?.learned ?? []) ops.push({ id: id(), at, day, kind: 'word', german, learned: true });
  for (const [lesson, score] of Object.entries(old?.grammar ?? {})) ops.push({ id: id(), at, day, kind: 'score', lesson, score });
  for (const [xpDay, points] of Object.entries(old?.xp ?? {})) {
    // The server takes at most 500 points per operation.
    for (let left = points; left > 0; left -= 500) ops.push({ id: id(), at, day: xpDay, kind: 'xp', amount: Math.min(left, 500) });
  }
  for (const [german, entry] of Object.entries(oldReviews?.words ?? {})) ops.push({ id: id(), at, day, kind: 'review', german, box: entry.box, due: entry.due });
  await storage.remove('progress');
  await storage.remove('srs');
  return ops;
}

/** Loads what was saved on the phone. Call once, before the first screen. */
export async function loadSync() {
  persisted = { ...persisted, ...(await storage.get<Partial<Persisted>>('sync', {})) };
  if (!persisted.device) persisted.device = `${platform}-${id()}`;
  persisted.outbox = [...(await migrateOldProgress()), ...persisted.outbox];
  save();
  recompute();
}

export const deviceId = () => persisted.device;

/** An operation as the app records it: the engine adds its id, time and day. */
export type NewOp = Op extends infer O ? (O extends Op ? Omit<O, 'id' | 'at' | 'day'> : never) : never;

/** Records something the learner did; it shows at once and is sent in the background. */
export function record(op: NewOp) {
  const full = { id: id(), at: Date.now(), day: dayKey(), ...op } as Op;
  persisted.outbox = [...persisted.outbox, full].slice(-MAX_OUTBOX);
  save();
  recompute();
  schedule();
}

/** Sends waiting operations (or, with none, fetches the latest state). Safe to call any time. */
export function flush(): Promise<void> {
  if (!signedIn) return Promise.resolve();
  if (inFlight) return inFlight;
  if (timer) clearTimeout(timer);
  inFlight = (async () => {
    const sending = persisted.outbox.slice(0, BATCH);
    status = { ...status, syncing: true };
    listeners.forEach(listener => listener());
    try {
      const snapshot = sending.length ? await api.postSync(sending, persisted.device) : await api.getSync();
      const sent = new Set(sending.map(op => op.id));
      // Operations recorded while the request was out stay in the outbox and keep showing on top.
      persisted = { ...persisted, snapshot, outbox: persisted.outbox.filter(op => !sent.has(op.id)), lastSync: Date.now() };
      retry = 0;
      status = { ...status, online: true };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 400) {
        // The server refused this batch (it can't be fixed by sending it again): drop it so the rest can go.
        const sent = new Set(sending.map(op => op.id));
        persisted = { ...persisted, outbox: persisted.outbox.filter(op => !sent.has(op.id)) };
      } else {
        status = { ...status, online: !error.offline };
        timer = setTimeout(() => void flush(), RETRY_MS[Math.min(retry++, RETRY_MS.length - 1)]);
      }
    } finally {
      inFlight = null;
      status = { ...status, syncing: false };
      save();
      recompute();
    }
    if (persisted.outbox.length && retry === 0) schedule(0);
  })();
  return inFlight;
}

/**
 * Starts syncing for the signed-in learner. Operations recorded before signing in (as a guest) go to the account,
 * so nothing done before signing in is lost; they merge by the same rules as everything else.
 */
export async function startSync() {
  signedIn = true;
  connectLive({
    onProgress: (revision, origin) => {
      if (origin !== persisted.device && revision !== persisted.snapshot?.revision) void flush();
    },
    onContent: () => contentListeners.forEach(listener => listener()),
    onReconnected: () => void flush(),
  });
  await flush();
}

/**
 * Stops syncing. Signing out (`forget`): send what is waiting, then forget this learner's progress on the phone,
 * where the next person may learn (it is safe in the account). A sign-in that expired (the password was changed
 * elsewhere, or an admin removed this device): keep what wasn't sent, so it reaches the account next time.
 */
export async function stopSync({ forget }: { forget: boolean }) {
  if (forget) await flush().catch(() => {});
  signedIn = false;
  disconnectLive();
  if (timer) clearTimeout(timer);
  persisted = { ...persisted, snapshot: null, outbox: forget ? [] : persisted.outbox, lastSync: null };
  save();
  recompute();
}

/** Called when text an admin published (the course refreshes). */
export function onContentChanged(listener: () => void) {
  contentListeners.add(listener);
  return () => {
    contentListeners.delete(listener);
  };
}

// Back in the front, or back online: catch up at once.
AppState.addEventListener('change', next => {
  if (next === 'active' && signedIn) void flush();
});
Network.addNetworkStateListener(({ isConnected, isInternetReachable }) => {
  const online = !!isConnected && isInternetReachable !== false;
  status = { ...status, online };
  listeners.forEach(listener => listener());
  if (online && signedIn) {
    retry = 0;
    void flush();
  }
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The learner's state, with changes not yet confirmed already applied. */
export const useSyncState = () => useSyncExternalStore(subscribe, () => state);
export const useSyncStatus = () => useSyncExternalStore(subscribe, () => status);
export const syncState = () => state;

/** The open exercise to continue, if any (from this or another device). */
export function openSession(): (Session & { at?: number }) | null {
  const session = state.session;
  return session && !session.done && session.position < session.items.length ? session : null;
}

export const sessionDefaults = () => ({ platform, device: persisted.device }) as const;
