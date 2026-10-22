import { useEffect, useState } from 'react';

import { api } from '@/core/api/client';
import type { WhyGerman } from '@/core/api/types';

/** The website's sourced reasons to learn German, in the chosen language; null until loaded or when offline. */
export function useWhyGerman(lang: string) {
  const [data, setData] = useState<WhyGerman | null>(null);
  useEffect(() => {
    let current = true;
    api.whyGerman(lang).then(
      result => current && setData(result),
      () => {
        // Offline on first start: the introduction goes on without the figures.
      },
    );
    return () => {
      current = false;
    };
  }, [lang]);
  return data?.lang === lang ? data : null;
}
