import { Text as NativeText } from 'react-native';

import { Text } from './primitives';
import type { TypeRole } from './theme';

type Mark = 'german' | 'strong' | 'em';
type Run = { text: string; marks: Mark[] };

const TAG = /<(\/?)(em|strong)(\s+class="de")?\s*>/g;

/**
 * Course text with the website's inline markup: <em class="de"> marks German inside an explanation, <strong>
 * stresses a word. Anything else in angle brackets is not expected and is left out rather than shown.
 */
export function parseMarkup(source: string): Run[] {
  const runs: Run[] = [];
  const open: Mark[] = [];
  let last = 0;
  const push = (text: string) => {
    const clean = text.replace(/<[^>]*>/g, '');
    if (clean) runs.push({ text: clean, marks: [...open] });
  };
  for (const match of source.matchAll(TAG)) {
    push(source.slice(last, match.index));
    last = match.index + match[0].length;
    const [, closing, tag, german] = match;
    if (closing) {
      const at = open.lastIndexOf(tag === 'strong' ? 'strong' : open.includes('german') ? 'german' : 'em');
      if (at >= 0) open.splice(at, 1);
    } else {
      open.push(tag === 'strong' ? 'strong' : german ? 'german' : 'em');
    }
  }
  push(source.slice(last));
  return runs;
}

/** Text that may carry the course's inline markup, shown as the website shows it: German words in bold. */
export function RichText({ children, variant = 'body', colour }: { children: string; variant?: TypeRole; colour?: 'text' | 'muted' }) {
  const runs = parseMarkup(children);
  return (
    <Text variant={variant} colour={colour}>
      {runs.map((run, i) =>
        run.marks.length ? (
          <NativeText
            key={i}
            style={{
              fontWeight: run.marks.includes('german') || run.marks.includes('strong') ? '700' : undefined,
              fontStyle: run.marks.includes('em') ? 'italic' : 'normal',
            }}>
            {run.text}
          </NativeText>
        ) : (
          run.text
        ),
      )}
    </Text>
  );
}
