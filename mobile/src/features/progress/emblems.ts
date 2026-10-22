/**
 * Each unit's place on the course map: an engraved emblem of its topic, drawn like the symbols on an old map
 * (the same drawings as the website's map, web/static/course/js/course.js). They share one 24-wide grid with the
 * ground at y = 20, so every emblem stands on its point on the road.
 *
 * Parts are drawn in order with one of these looks: `fill` (paper with an ink outline), `accent` (gold wash),
 * `leaf` (green wash), `line` (an ink line), `hatch` (fine shading) and `wave` (water).
 */
export type EmblemLook = 'fill' | 'accent' | 'leaf' | 'line' | 'hatch' | 'wave';
export type EmblemPart =
  | { look: EmblemLook; d: string; rotate?: number }
  | { look: EmblemLook; ellipse: [cx: number, cy: number, rx: number, ry: number] };

const p = (look: EmblemLook, d: string, rotate?: number): EmblemPart => ({ look, d, rotate });
const e = (look: EmblemLook, cx: number, cy: number, rx: number, ry = rx): EmblemPart => ({ look, ellipse: [cx, cy, rx, ry] });

// The windmill's four sails, each a spar with its sail and two cross-laths, turned about the hub.
const sails = [45, 135, 225, 315].flatMap(angle => [
  p('line', 'M12 6V-4', angle),
  p('fill', 'M12.4 4.5V-3.5H15.4V4.5Z', angle),
  p('hatch', 'M12.4 -1H15.4M12.4 1.6H15.4', angle),
]);

export const EMBLEMS: Record<number, EmblemPart[]> = {
  // Start: pronunciation and numbers, a herald's speaking-horn
  0: [p('fill', 'M2 13L16 7V19L2 15Z'), p('fill', 'M0 13h2v2H0z'), e('accent', 16, 13, 2.5, 6), p('hatch', 'M6 12.5v3M9 11v5.5M12 9.5v7'), p('line', 'M20 9q3 4 0 8M22.5 7q4.5 6 0 12')],
  // 1: introductions and greetings, a banner on two posts
  1: [p('line', 'M3 13V20M21 13V20'), p('fill', 'M1 4C5 2 9 6 12 4S19 2 23 4V13C19 11 15 15 12 13S5 11 1 13Z'), e('accent', 1, 8.5, 1.8, 4.5), e('accent', 23, 8.5, 1.8, 4.5), p('hatch', 'M5 7.5h13M5 10h9')],
  // 2: family, a family tree
  2: [p('fill', 'M10.5 20V12h3v8'), p('line', 'M10.5 20q-2 0-3.5 1M13.5 20q2 0 3.5 1'), p('leaf', 'M12 0C6 0 3 4 4 8C1 9 1 14 5 14H19C23 14 23 9 20 8C21 4 18 0 12 0Z'), p('hatch', 'M16 4l3 3M15 7l4 4M13 10l3 3M8 3l-2 2')],
  // 3: food and shopping, a market stall with its awning and produce
  3: [p('line', 'M4 12V5M20 12V5'), p('fill', 'M3 12h18v8H3z'), p('accent', 'M2 5H22L20.5 9H3.5Z'), p('line', 'M3.5 9q2 2 4.25 0q2 2 4.25 0q2 2 4.25 0q2 2 4.25 0M8 5l-.5 4M12 5v4M16 5l.5 4'), e('accent', 8, 10.5, 1.8), e('leaf', 12, 10.8, 1.6), e('accent', 16, 11, 2.4, 1.4), p('hatch', 'M5 14v5M8 14v5M11 14v5M14 14v5M17 14v5')],
  // 4: home and living, a cottage with a smoking chimney
  4: [p('line', 'M17.5 1q-2-2 0-4q2-2 0-4'), p('fill', 'M16 7V1h3v8'), p('fill', 'M4 20V10h16v10Z'), p('accent', 'M2 11L12 2L22 11Z'), p('fill', 'M10 20v-5h4v5'), p('fill', 'M6 13h3v3H6z'), p('fill', 'M15 13h3v3h-3z'), p('hatch', 'M8 8.5l2 2M12 5.5l3 3M15 8l2 2')],
  // 5: daily routine and time, an hourglass
  5: [p('line', 'M5 2v16M19 2v16'), p('fill', 'M3 0h18v2H3zM3 18h18v2H3z'), p('fill', 'M7 2C7 8 11 9 11 10C11 11 7 12 7 18H17C17 12 13 11 13 10C13 9 17 8 17 2Z'), p('accent', 'M8.6 5H15.4C15 7.5 12.6 8.6 12 9.6C11.4 8.6 9 7.5 8.6 5Z'), p('accent', 'M8 18C9 15.5 11 14.2 12 13.2C13 14.2 15 15.5 16 18Z'), p('line', 'M12 10v3.4')],
  // 6: weather, holidays and hobbies, a sun behind a cloud
  6: [p('line', 'M9 -2v-3M9 16v3M0 7h-3M18 7h3M2.6 0.6l-2-2M15.4 0.6l2-2M2.6 13.4l-2 2'), e('accent', 9, 7, 5.5), p('hatch', 'M6.5 6.5h.01M11.5 6.5h.01M7 9.5q2 1.5 4 0'), p('fill', 'M8 19C4.5 19 4.5 13.5 9 13.5C9 9.5 15.5 9.5 16.5 12.5C19.5 11.5 22.5 13.5 21.5 16.5C22.5 18.5 20.5 19.5 19 19Z'), p('hatch', 'M10 17h9M12 15.5h6')],
  // 7: jobs and abilities, a windmill at work
  7: [p('fill', 'M8 20L10 8H14L16 20Z'), p('accent', 'M9.5 8L12 4.5L14.5 8Z'), p('fill', 'M11 20v-3.5a1 1 0 0 1 2 0V20'), p('hatch', 'M11 11h2.5M10.5 14h3.5'), ...sails, e('accent', 12, 6, 1.2)],
  // 8: travel and transport, a sailing ship on the waves
  8: [p('line', 'M12 13V-6'), p('accent', 'M12 -6L17.5 -4.8L12 -3.6Z'), p('fill', 'M6 -3Q12 -1 18 -3V9Q12 11 6 9Z'), p('hatch', 'M8 1Q12 2.4 16 1M8 5Q12 6.4 16 5'), p('fill', 'M1 13H23L20 18.5H4Z'), p('accent', 'M2.2 14.6H21.8L21.3 15.6H2.7Z'), p('wave', 'M0 20.5q3-2 6 0t6 0t6 0t6 0')],
  // 9: yesterday and last year, the journey's end: a columned gate
  9: [p('accent', 'M9.5 3l1-2.6h3l1 2.6'), p('fill', 'M5 3h14v3H5z'), p('fill', 'M1 6h22v2.4H1z'), p('fill', 'M2.2 8.4h1.8V18H2.2zM6.6 8.4h1.8V18H6.6zM11.1 8.4h1.8V18h-1.8zM15.6 8.4h1.8V18h-1.8zM20 8.4h1.8V18H20z'), p('fill', 'M0 18h24v2H0z'), p('hatch', 'M7 4.5h10')],
};

/** Any unit without its own emblem keeps the engraved town. */
export const TOWN: EmblemPart[] = [
  p('fill', 'M3 20V11l3-4 3 4v9M9 20V6l3-6 3 6v14M15 20V12l3-4 3 4v8'),
  p('line', 'M11 20v-3a1 1 0 0 1 2 0v3'),
];
