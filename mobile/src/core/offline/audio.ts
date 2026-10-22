import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

import { api } from '@/core/api/client';
import { apiUrl } from '@/core/config';
import type { ApiIndex, AudioManifest, Unit } from '@/core/api/types';

/**
 * The course's recorded audio. Clips stream from the server, and a unit can be downloaded so it plays
 * offline: files are kept at <documents>/audio/<voice>/<speed>/<id>.mp3, the same layout as on the server.
 */

export type Voice = 'katja' | 'conrad';
export const SPEED = 'normal';
const PARALLEL_DOWNLOADS = 6;

let index: ApiIndex | null = null;
let manifest: AudioManifest = {};
let player: AudioPlayer | null = null;

const manifestFile = () => new File(Paths.document, 'audio-manifest.json');
const voiceDir = (voice: Voice) => new Directory(Paths.document, 'audio', voice, SPEED);
const clipFile = (voice: Voice, id: string) => new File(voiceDir(voice), `${id}.mp3`);

let loading: Promise<void> | null = null;

/** Loads the clip list: the saved one at once, then the server's when it can be reached. Safe to call again. */
export function loadAudio() {
  loading ??= load().finally(() => {
    loading = null;
  });
  return loading;
}

async function load() {
  // Recordings are the lesson, not background noise: they play with the iPhone's silent switch on, and other
  // audio (music, a podcast) is turned down while they do.
  void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
  const saved = manifestFile();
  if (saved.exists) manifest = JSON.parse(await saved.text());
  try {
    index = await api.index();
    const response = await fetch(index.audio.manifest, { cache: 'no-store' });
    if (response.ok) {
      manifest = await response.json();
      saved.write(JSON.stringify(manifest));
    }
  } catch {
    // Offline: the saved list (and any downloaded clips) still work.
  }
}

/** The address of a word picture (Twemoji SVG, by its code), once the server has been reached. */
export function pictureUrl(code: string) {
  return `${index?.pictureBase ?? `${apiUrl()}/static/course/pics/`}${code}.svg`;
}

export function hasClip(german: string) {
  return german in manifest;
}

/**
 * A clip on the server. Its address follows a fixed pattern, so playing doesn't depend on having reached the server
 * at start-up (the server's own answer wins when there is one).
 */
function remoteUrl(voice: Voice, id: string) {
  const base = index?.audio.base ?? `${apiUrl()}/static/audio/`;
  return `${base}${voice}/${SPEED}/${id}.mp3`;
}

/** Plays the recording of `german`: the downloaded copy when there is one, otherwise from the server. */
export function play(german: string, voice: Voice) {
  const id = manifest[german];
  if (!id) return false;
  const local = clipFile(voice, id);
  const uri = local.exists ? local.uri : remoteUrl(voice, id);
  // Not reached at start-up (offline then, or the server moved): try again in the background.
  if (!index) void loadAudio();
  if (!player) player = createAudioPlayer(uri);
  else player.replace(uri);
  player.seekTo(0);
  player.play();
  return true;
}

/** Every German text in a unit that has a recording: its words, examples, tables and quiz answers. */
export function unitTexts(unit: Unit) {
  const texts = new Set<string>();
  for (const section of unit.sections) for (const word of section.words) texts.add(word.german);
  for (const lesson of unit.grammar) {
    for (const block of lesson.blocks ?? []) {
      for (const [german] of block.examples ?? []) texts.add(german);
      for (const said of block.table?.say ?? []) texts.add(said);
    }
    for (const item of lesson.quiz?.items ?? []) if (item.say) texts.add(item.say);
  }
  return [...texts].filter(hasClip);
}

export function downloadedCount(unit: Unit, voice: Voice) {
  const texts = unitTexts(unit);
  return { done: texts.filter(t => clipFile(voice, manifest[t]).exists).length, total: texts.length };
}

/** Saves a unit's clips for offline use; already saved clips are skipped, so it can resume after a break. */
export async function downloadUnit(unit: Unit, voice: Voice, onProgress: (done: number, total: number) => void) {
  if (!index) await loadAudio();
  const dir = voiceDir(voice);
  if (!dir.exists) dir.create({ intermediates: true });
  const ids = unitTexts(unit).map(t => manifest[t]);
  const missing = ids.filter(id => !clipFile(voice, id).exists);
  let done = ids.length - missing.length;
  onProgress(done, ids.length);

  const queue = [...missing];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      await File.downloadFileAsync(remoteUrl(voice, id), clipFile(voice, id), { idempotent: true });
      onProgress(++done, ids.length);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
}

/** Frees the space used by downloaded audio. */
export function deleteDownloads() {
  const dir = new Directory(Paths.document, 'audio');
  if (dir.exists) dir.delete();
}

export function downloadedBytes() {
  const dir = new Directory(Paths.document, 'audio');
  return dir.exists ? (dir.size ?? 0) : 0;
}

/** Forgets the old server's answers and asks the current one (after its address changed under Me). */
export function reloadAudio() {
  index = null;
  return loadAudio();
}
