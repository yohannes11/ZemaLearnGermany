import { AppState } from 'react-native';

import { currentToken } from '@/core/api/client';
import { apiUrl } from '@/core/config';

/**
 * The live connection (/ws/v1/): the server says when another device changed the learner's progress, or when an
 * admin published text. Messages only say *that* something changed; the engine then fetches it, so a message
 * lost while reconnecting costs nothing but a short delay. Closed while the app is in the background.
 */

type Handlers = { onProgress: (revision: number, origin: string) => void; onContent: () => void; onReconnected: () => void };

const PING_MS = 25_000;
let socket: WebSocket | null = null;
let handlers: Handlers | null = null;
let backoff = 1000;
let reconnect: ReturnType<typeof setTimeout> | null = null;
let ping: ReturnType<typeof setInterval> | null = null;
let everConnected = false;

function open() {
  const token = currentToken();
  if (!handlers || !token || socket) return;
  const ws = new WebSocket(`${apiUrl().replace(/^http/, 'ws')}/ws/v1/`);
  socket = ws;
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', token }));
    backoff = 1000;
    ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), PING_MS);
    if (everConnected) handlers?.onReconnected();
    everConnected = true;
  };
  ws.onmessage = event => {
    let message: { type?: string; revision?: number; origin?: string };
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (message.type === 'progress' && typeof message.revision === 'number') handlers?.onProgress(message.revision, message.origin ?? '');
    if (message.type === 'content') handlers?.onContent();
  };
  ws.onclose = () => {
    if (ping) clearInterval(ping);
    if (socket !== ws) return;
    socket = null;
    if (handlers && AppState.currentState === 'active') {
      reconnect = setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 60_000);
    }
  };
}

function close() {
  if (reconnect) clearTimeout(reconnect);
  if (ping) clearInterval(ping);
  const ws = socket;
  socket = null;
  ws?.close();
}

export function connectLive(next: Handlers) {
  handlers = next;
  close();
  open();
}

export function disconnectLive() {
  handlers = null;
  everConnected = false;
  close();
}

AppState.addEventListener('change', next => {
  if (next === 'active') open();
  else close();
});
