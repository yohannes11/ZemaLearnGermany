import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import type { Word } from '@/core/api/types';
import { useCourse } from '@/core/course';
import { openSession } from '@/core/sync/engine';
import { useProgress } from '@/features/progress/store';
import { CardSession } from '@/features/vocabulary/card-session';
import { dueWords, REVIEW_SESSION_SIZE, useSrs } from '@/features/vocabulary/srs';

/**
 * Flashcards for a vocabulary section (?section=key, words still to learn first), today's review (?review=1), or a
 * deck left open on this or another device (?resume=1).
 */
export default function CardsRoute() {
  const { section: key, review, resume } = useLocalSearchParams<{ section?: string; review?: string; resume?: string }>();
  const { bundle, t } = useCourse();
  const { learned } = useProgress();
  const { words } = useSrs();
  // The deck is fixed when the session opens, so answering doesn't reshuffle it.
  const [session] = useState<{ deck: Word[]; title: string; ref: string; answers?: boolean[] }>(() => {
    if (!bundle) return { deck: [], title: '', ref: '' };
    const all = new Map(bundle.course.units.flatMap(u => u.sections.flatMap(s => s.words)).map(w => [w.german, w]));
    const saved = resume ? openSession() : null;
    if (saved?.kind === 'cards') {
      const section = bundle.course.units.flatMap(u => u.sections).find(s => s.key === saved.ref);
      const deck = saved.items.map(german => all.get(String(german))).filter((w): w is Word => !!w);
      return { deck, title: section ? t(section.title) : "today's review", ref: saved.ref, answers: saved.answers.slice(0, saved.position) };
    }
    if (review) return { deck: dueWords(bundle.course, learned, words).slice(0, REVIEW_SESSION_SIZE), title: "today's review", ref: 'review' };
    const section = bundle.course.units.flatMap(u => u.sections).find(s => s.key === key);
    const known = new Set(learned);
    const sectionWords = section?.words ?? [];
    return {
      deck: [...sectionWords.filter(w => !known.has(w.german)), ...sectionWords.filter(w => known.has(w.german))],
      title: section ? t(section.title) : '',
      ref: section?.key ?? '',
    };
  });
  return <CardSession deck={session.deck} title={session.title} sessionRef={session.ref} answers={session.answers} />;
}
