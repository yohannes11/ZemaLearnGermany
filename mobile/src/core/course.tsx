import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/core/api/client';
import type { CourseBundle, Lesson, Unit, Word } from '@/core/api/types';
import { cachedCourse, refreshCourse } from '@/core/offline/course';
import { loadAudio } from '@/core/offline/audio';
import { onContentChanged } from '@/core/sync/engine';
import { storage } from '@/core/storage';

export type Lang = 'en' | 'am';

type CourseState = {
  bundle: CourseBundle | null;
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Set when the course couldn't be loaded at all (first start without a connection). */
  error: string | null;
  refresh: () => Promise<void>;
  /** A course text as the site shows it: in Amharic when chosen, then with any change an admin published. */
  t: (text: string) => string;
  meaning: (word: Word) => string;
  unit: (id: number) => Unit | undefined;
  lesson: (key: string) => { unit: Unit; lesson: Lesson } | undefined;
};

const CourseContext = createContext<CourseState | null>(null);

export function CourseProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<CourseBundle | null>(null);
  const [lang, setLangState] = useState<Lang>('en');
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const refresh = useCallback(
    () =>
      refreshCourse(lang, bundle).then(
        fresh => {
          if (fresh) setBundle(fresh);
          setError(null);
        },
        (problem: unknown) => {
          if (!(problem instanceof ApiError)) throw problem;
          if (!bundle) setError(problem.message);
        },
      ),
    [lang, bundle],
  );

  // The saved copy first, so the app opens at once and offline; then the server's, if it changed.
  useEffect(() => {
    (async () => {
      const saved = await storage.get<Lang>('lang', 'en');
      setLangState(saved);
      const cached = await cachedCourse(saved);
      if (cached) setBundle(cached);
      setStarted(true);
      void loadAudio();
    })();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (!bundle || bundle.lang !== lang) void refresh();
    // Coming back to the app checks for content an admin published meanwhile.
    const listener = AppState.addEventListener('change', next => next === 'active' && void refresh());
    return () => listener.remove();
  }, [started, lang, bundle, refresh]);

  // An admin published text: fetch the course again (one small request; unchanged parts cost nothing).
  useEffect(() => onContentChanged(() => void refresh()), [refresh]);

  const setLang = useCallback((next: Lang) => {
    storage.set('lang', next);
    setLangState(next);
    void cachedCourse(next).then(cached => cached && setBundle(cached));
  }, []);

  const value = useMemo<CourseState>(() => {
    const texts = bundle?.texts ?? {};
    const amharic = bundle?.amharic;
    // Published changes are keyed by the text as shown (see web/apps/content), so they apply after translating.
    const shown = (text: string) => texts[text] ?? text;
    const t = (text: string) => shown(amharic?.text[text] ?? text);
    const units = bundle?.course.units ?? [];
    return {
      bundle,
      lang,
      setLang,
      error,
      refresh,
      t,
      meaning: word => shown(amharic?.words[word.german] ?? word.english),
      unit: id => units.find(unit => unit.id === id),
      lesson: key => {
        for (const unit of units) {
          const lesson = unit.grammar.find(l => l.key === key);
          if (lesson) return { unit, lesson };
        }
        return undefined;
      },
    };
  }, [bundle, lang, setLang, error, refresh]);

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
}

export function useCourse() {
  const course = useContext(CourseContext);
  if (!course) throw new Error('useCourse must be used inside <CourseProvider>');
  return course;
}
