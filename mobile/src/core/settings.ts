import type { Voice } from './offline/audio';
import { createStore, useStore } from './store';

export type Settings = {
  /** Set once the first-run introduction is finished or skipped. */
  onboarded: boolean;
  /** Days whose strikeout this device has already animated, so each strike draws itself once (newest last). */
  struck: string[];
  voice: Voice;
  /** Test builds only: the server address, when the computer running it got a new one. Empty: the built-in one. */
  serverUrl: string;
};

export const settings = createStore<Settings>('settings', { onboarded: false, struck: [], voice: 'katja', serverUrl: '' });
export const useSettings = () => useStore(settings);
