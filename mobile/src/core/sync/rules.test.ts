// The app's sync rules against the cases the server is tested with. Run: npm run test:sync
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { apply, emptyState, type Op, type SyncState } from './rules.ts';

type Case = { name: string; arrivals: Op[][]; expect: Record<string, unknown> };
const cases: Case[] = JSON.parse(
  readFileSync(new URL('../../../../web/apps/course/tests/sync_cases.json', import.meta.url), 'utf8'),
).cases;

/** Like the server: operations arrive in batches, each id applies once, a batch is applied oldest first. */
function arrive(batches: Op[][]): SyncState {
  const seen = new Set<string>();
  let state = emptyState();
  for (const batch of batches) {
    const fresh = batch.filter(op => !seen.has(op.id) && (seen.add(op.id), true));
    fresh.sort((a, b) => (a.at !== b.at ? a.at - b.at : a.id < b.id ? -1 : 1)).forEach(op => (state = apply(state, op)));
  }
  return state;
}

for (const c of cases) {
  test(c.name, () => {
    const state = arrive(c.arrivals);
    for (const [field, expected] of Object.entries(c.expect)) {
      let actual: unknown = state[field as keyof SyncState];
      if (field === 'learned') {
        assert.deepEqual([...(actual as string[])].sort(), [...(expected as string[])].sort());
        continue;
      }
      if (field === 'goals') actual = state.goals.map(([day, , xp]) => [day, xp]);
      if (field === 'srs') actual = Object.fromEntries(Object.entries(state.srs).map(([w, r]) => [w, { box: r.box, due: r.due }]));
      if (field === 'session' && state.session) {
        const { at: _at, id: _id, ...rest } = state.session;
        actual = { ...rest, device: rest.device ?? '' };
      }
      assert.deepEqual(actual, expected, field);
    }
  });
}
