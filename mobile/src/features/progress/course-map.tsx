import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import type { Unit } from '@/core/api/types';
import { useCourse } from '@/core/course';
import { nextSection } from '@/features/progress/next-steps';
import { useProgress } from '@/features/progress/store';
import { Icon } from '@/ui/primitives';
import { EMBLEMS, TOWN, type EmblemLook } from '@/features/progress/emblems';
import { elevation, radius, serif, space, useColours, type Colours } from '@/ui/theme';

/**
 * The course as a map, as on the website: one town per unit along a road, each unit's title and progress as its
 * place name; each place is an engraved emblem of its unit's topic. The road is solid where the learner has
 * travelled and dashed ahead; the place to work on next is circled by hand and a passed unit test plants a pennant. The map scrolls sideways;
 * a tap on a town (or its name) opens the unit.
 */

const HEIGHT = 340;
const SPACING = 132; // between towns, so every name has room
const EDGE = 108; // half the widest name, so the first and last names are never cut off
// A strict zig-zag: each name sits on the other side from its neighbours (below in a dip, above on a crest).
const MAP_Y = [0.76, 0.3, 0.7, 0.26, 0.74, 0.34, 0.78, 0.28, 0.7, 0.36];
const UNIT_TEST_PASS = 9; // as features/progress/next-steps.ts

type Point = { x: number; y: number };

/** A smooth road through the points (Catmull-Rom), split into one curve per leg. */
function legs(pts: Point[]) {
  return pts.slice(0, -1).map((p1, i) => {
    const p0 = pts[i - 1] ?? p1;
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    return `C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  });
}

/** A title broken into lines of at most `max` characters, at word boundaries. */
function lines(title: string, max = 17) {
  const out: string[] = [];
  for (const word of title.split(' ')) {
    const last = out[out.length - 1];
    if (last && (last + ' ' + word).length <= max) out[out.length - 1] = `${last} ${word}`;
    else out.push(word);
  }
  return out;
}

/** You are here: a ring drawn by hand around the town. */
function InkRing({ x, y, colour }: Point & { colour: string }) {
  return (
    <Path
      d={`M${x + 10} ${y - 34}C${x - 4} ${y - 40} ${x - 26} ${y - 36} ${x - 30} ${y - 22}S${x - 18} ${y + 2} ${x} ${y}S${x + 28} ${y - 12} ${x + 25} ${y - 25}S${x + 10} ${y - 38} ${x - 4} ${y - 35}`}
      stroke={colour}
      strokeWidth={2.6}
      strokeLinecap="round"
      fill="none"
    />
  );
}

/** A unit's emblem (features/progress/emblems.ts) on its washed ground; a pennant flies over a passed unit test. */
function Emblem({ x, y, id, big, flag, c }: Point & { id: number; big: boolean; flag: boolean; c: Colours }) {
  const s = big ? 1.6 : 1.3;
  const looks: Record<EmblemLook, object> = {
    fill: { fill: c.surface, stroke: c.text, strokeWidth: 1.2, strokeLinejoin: 'round' },
    accent: { fill: c.goldBright, fillOpacity: 0.5, stroke: c.text, strokeWidth: 1, strokeLinejoin: 'round' },
    leaf: { fill: c.brand, fillOpacity: 0.3, stroke: c.text, strokeWidth: 1.1, strokeLinejoin: 'round' },
    line: { fill: 'none', stroke: c.text, strokeWidth: 1 },
    hatch: { fill: 'none', stroke: c.text, strokeWidth: 0.6, strokeLinecap: 'round', strokeOpacity: 0.6 },
    wave: { fill: 'none', stroke: c.brand, strokeWidth: 1.2, strokeLinecap: 'round' },
  };
  return (
    <G transform={`translate(${x - 12 * s} ${y - 21 * s}) scale(${s})`}>
      <Ellipse cx={12} cy={20} rx={12} ry={2.6} fill={c.goldBright} fillOpacity={0.4} />
      {(EMBLEMS[id] ?? TOWN).map((part, k) =>
        'd' in part ? (
          <Path key={k} d={part.d} transform={part.rotate ? `rotate(${part.rotate} 12 6)` : undefined} {...looks[part.look]} />
        ) : (
          <Ellipse key={k} cx={part.ellipse[0]} cy={part.ellipse[1]} rx={part.ellipse[2]} ry={part.ellipse[3]} {...looks[part.look]} />
        ),
      )}
      {flag && (
        <>
          <Path d="M24 4V-9" stroke={c.text} strokeWidth={1.1} />
          <Path d="M24 -9L30 -7 24 -5Z" fill={c.goldBright} stroke={c.text} strokeWidth={0.6} />
        </>
      )}
    </G>
  );
}

export function CourseMap() {
  const c = useColours();
  const isDark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const { bundle, t } = useCourse();
  const { learned, grammar } = useProgress();
  const scroller = useRef<ScrollView>(null);

  const units = bundle?.course.units ?? [];
  const n = units.length;
  const mapWidth = Math.max(width, EDGE * 2 + (n - 1) * SPACING);
  const known = useMemo(() => new Set(learned), [learned]);
  const next = bundle ? nextSection(bundle.course, learned) : null;
  const here = Math.max(0, next ? units.indexOf(next.unit) : n - 1);

  const pts: Point[] = units.map((_, i) => ({
    x: n > 1 ? EDGE + (i * (mapWidth - EDGE * 2)) / (n - 1) : mapWidth / 2,
    y: Math.round(MAP_Y[i % MAP_Y.length] * HEIGHT),
  }));
  const road = legs(pts);
  const travelled = pts.length ? `M${pts[0].x} ${pts[0].y}${road.slice(0, here).join('')}` : '';
  const ahead = pts.length ? `M${pts[here].x} ${pts[here].y}${road.slice(here).join('')}` : '';

  // Open on the town to work on next.
  const centre = (animated: boolean) => {
    const p = pts[here];
    if (p) scroller.current?.scrollTo({ x: Math.max(0, p.x - width / 2), animated });
  };
  useEffect(() => {
    const id = setTimeout(() => centre(false), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, mapWidth]);

  if (!bundle || !n) return null;

  const stats = (u: Unit) => {
    const words = new Set(u.sections.flatMap(s => s.words.map(w => w.german)));
    const done = [...words].filter(g => known.has(g)).length;
    const test = u.grammar.find(g => g.custom === 'review');
    const passed = !!test && (grammar[test.key] ?? -1) >= UNIT_TEST_PASS;
    return { done, total: words.size, passed };
  };

  // Where each town's name goes: on the side the road is not (above on a crest, below in a dip).
  const places = units.map((u, i) => {
    const p = pts[i];
    const near = [pts[i - 1], pts[i + 1]].filter(Boolean);
    const above = p.y < near.reduce((sum, q) => sum + q.y, 0) / near.length;
    const active = i === here;
    const last = i === n - 1;
    const title = lines(t(u.title));
    const size = active ? 20 : 17;
    const lineHeight = size + 3;
    const block = lineHeight * title.length + 18; // the title lines and the progress line
    const top = above ? p.y - (last ? 64 : active ? 56 : 50) - block + lineHeight : p.y + (active || last ? 30 : 24);
    return { u, p, above, active, last, title, size, lineHeight, top, block, ...stats(u) };
  });

  return (
    <View style={[styles.wrap, { height: HEIGHT }]}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: mapWidth, height: HEIGHT }}
        accessibilityLabel="Course map">
        {/* The land: soft washes and a sea in the corner, stretched to the map; decoration only. */}
        <Svg width={mapWidth} height={HEIGHT} viewBox="0 0 1000 400" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d="M-10 210C70 230 150 250 210 310S290 390 270 410H-10Z" fill={c.goldBright} fillOpacity={0.12} />
          <Path d="M270 410C310 330 350 280 430 262S570 244 630 284 670 364 650 410Z" fill={c.brand} fillOpacity={0.07} />
          <Path d="M650 410C670 300 630 220 710 160S870 60 1010 80V410Z" fill={c.brand} fillOpacity={0.11} />
          <Path d="M420 -10C440 60 520 92 600 82S700 22 720 -10Z" fill={c.goldBright} fillOpacity={0.1} />
          <Path d="M-10 -10H110C96 40 80 90 56 130S20 190 -10 200Z" fill={c.brand} fillOpacity={0.13} />
          <Path d="M-10 200C20 190 36 170 56 130S96 40 110 -10" fill="none" stroke={c.goldBright} strokeOpacity={0.45} strokeWidth={6} />
        </Svg>

        <Svg width={mapWidth} height={HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.bg} stopOpacity={0} />
              <Stop offset="1" stopColor={c.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          {here < n - 1 && <Path d={ahead} fill="none" stroke={c.muted} strokeOpacity={0.7} strokeWidth={2} strokeDasharray="7 6" strokeLinecap="round" />}
          {here > 0 && <Path d={travelled} fill="none" stroke={c.brand} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />}

          {places.map(({ u, p, active, last, title, size, lineHeight, top, done, total, passed }) => {
            const meta = `${t(u.label ?? `Unit ${u.id}`)} · ${Math.round((done / total) * 100)}%${passed ? ' ✓' : ''}`;
            // A halo of the page colour (the same text, stroked, underneath) keeps every name readable.
            const halo = { stroke: c.bg, strokeWidth: 5, strokeLinejoin: 'round' as const };
            return (
              <G key={u.id}>
                <Emblem x={p.x} y={p.y} id={u.id} big={last} flag={passed} c={c} />
                {active && <InkRing x={p.x} y={p.y} colour={c.brand} />}
                {[halo, null].map((h, k) => (
                  <G key={k}>
                    {title.map((line, j) => (
                      <SvgText
                        key={j}
                        x={p.x}
                        y={top + j * lineHeight}
                        textAnchor="middle"
                        fontFamily={serif.bold}
                        fontSize={size}
                        fill={active ? c.brandDeep : c.text}
                        {...(h ?? {})}>
                        {line}
                      </SvgText>
                    ))}
                    <SvgText
                      x={p.x}
                      y={top + (title.length - 1) * lineHeight + 18}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight="700"
                      fill={active ? c.brand : c.muted}
                      {...(h ?? {})}>
                      {meta}
                    </SvgText>
                  </G>
                ))}
              </G>
            );
          })}

          <Rect x={0} y={HEIGHT - 28} width={mapWidth} height={28} fill="url(#fade)" />
        </Svg>

        {/* Touch targets over each town and its name, for fingers and screen readers. */}
        {places.map(({ u, p, above, active, top, block, size, done, total, passed }) => {
          // From the top of the name to the foot of the town (name above), or the town's top to the name's end.
          const from = above ? top - size : p.y - 46;
          const to = above ? p.y + 6 : top + block;
          return (
            <Pressable
              key={u.id}
              onPress={() => {
                void Haptics.selectionAsync();
                router.push({ pathname: '/unit/[id]', params: { id: String(u.id) } });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t(u.label ?? `Unit ${u.id}`)}: ${t(u.title)}. ${done} of ${total} words learned${passed ? '. Unit test passed' : ''}${active ? '. You are here' : ''}`}
              accessibilityHint="Opens the unit"
              style={({ pressed }) => [styles.hit, { left: p.x - SPACING / 2, top: from, height: to - from, width: SPACING, backgroundColor: pressed ? c.brandSoft : 'transparent', opacity: 0.6 }]}
            />
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => centre(true)}
        accessibilityRole="button"
        accessibilityLabel="Show where I am"
        hitSlop={8}
        style={({ pressed }) => [styles.locate, elevation(1, isDark), { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
        <Icon name="crosshairs-gps" size={20} colour={c.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: -space.md, marginTop: -space.md },
  hit: { position: 'absolute', borderRadius: radius.md },
  locate: {
    position: 'absolute',
    right: space.md,
    bottom: space.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
