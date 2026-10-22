import { File, Paths } from 'expo-file-system';

import { api } from '@/core/api/client';
import type { CourseBundle } from '@/core/api/types';

function cacheFile(lang: string) {
  return new File(Paths.document, `course-${lang}.json`);
}

/** The course saved on this device, or null before the first download. */
export async function cachedCourse(lang: string): Promise<CourseBundle | null> {
  const file = cacheFile(lang);
  if (!file.exists) return null;
  try {
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

/**
 * Asks the server whether the course changed since `current` and saves the new copy if it did. Returns the new
 * course, or null when nothing changed. Costs one small 304 response while the copy is up to date.
 */
export async function refreshCourse(lang: string, current: CourseBundle | null): Promise<CourseBundle | null> {
  const fresh = await api.course(lang, current?.lang === lang ? current.version : undefined);
  if (fresh) cacheFile(lang).write(JSON.stringify(fresh));
  return fresh;
}
