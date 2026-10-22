import Constants from 'expo-constants';

import { settings } from './settings';

/**
 * Where the Django backend lives. Set EXPO_PUBLIC_API_URL in mobile/.env.local while developing
 * (e.g. http://192.168.1.4:8000 to reach the dev server from a phone on the same Wi-Fi); release builds use the
 * production site.
 */
const BUILT_IN_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://zemalearn.com').replace(/\/$/, '');

/** A test build talks plain http to a computer on the local network; its address can change, so Me lets it be set. */
export const isTestBuild = BUILT_IN_API_URL.startsWith('http://');
export const builtInApiUrl = BUILT_IN_API_URL;

/** The server to talk to: the address set under Me (test builds only), else the one built in. */
export function apiUrl() {
  const custom = isTestBuild ? settings.get().serverUrl.trim() : '';
  return (custom || BUILT_IN_API_URL).replace(/\/$/, '');
}

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
