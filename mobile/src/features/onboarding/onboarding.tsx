import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCourse, type Lang } from '@/core/course';
import * as tally from '@shared/tally';

import { settings } from '@/core/settings';
import { setDailyGoal } from '@/features/progress/store';
import { Button, Text } from '@/ui/primitives';
import { radius, space, useColours } from '@/ui/theme';

import { GoalSlide, HowSlide, ReasonSlide, Slide, WelcomeSlide } from './slides';
import { useWhyGerman } from './use-why-german';

type SlideKey = 'welcome' | 'how' | 'goal' | `reason:${string}`;
const REASONS = ['study', 'career', 'life'];

function Dot({ index, scroll, width }: { index: number; scroll: SharedValue<number>; width: number }) {
  const c = useColours();
  const style = useAnimatedStyle(() => {
    const at = scroll.get() / width;
    return {
      width: interpolate(at, [index - 1, index, index + 1], [8, 28, 8], 'clamp'),
      backgroundColor: interpolateColor(at, [index - 1, index, index + 1], [c.borderStrong, c.brand, c.borderStrong]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * The first-run introduction: why German is worth it (the website's sourced figures), how the app works, and a
 * daily goal. Skip goes straight to the goal, so every learner starts with one they chose.
 */
export function Onboarding() {
  const c = useColours();
  const { width } = useWindowDimensions();
  const { lang, setLang } = useCourse();
  const why = useWhyGerman(lang);
  const [goal, setGoal] = useState<number>(tally.DEFAULT_GOAL);
  const [index, setIndex] = useState(0);
  // The slide list is fixed once the learner moves on, so figures arriving late can't shift the pages.
  const [frozen, setFrozen] = useState<SlideKey[] | null>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scroll = useSharedValue(0);

  const reasons = why ? REASONS.filter(key => why.paths.some(p => p.key === key)) : [];
  const slides: SlideKey[] = frozen ?? ['welcome', ...reasons.map(key => `reason:${key}` as const), 'how', 'goal'];
  const last = slides.length - 1;

  const onScroll = useAnimatedScrollHandler(event => scroll.set(event.contentOffset.x));

  const goTo = (target: number) => {
    if (!frozen) setFrozen(slides);
    void Haptics.selectionAsync();
    scrollRef.current?.scrollTo({ x: target * width, animated: true });
    setIndex(target);
  };

  const finish = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // The root layout sees this and shows the app.
    setDailyGoal(goal);
    settings.set({ onboarded: true });
  };

  const render = (key: SlideKey) => {
    if (key === 'welcome') return <WelcomeSlide lang={lang} onLang={(next: Lang) => setLang(next)} />;
    if (key === 'how') return <HowSlide />;
    if (key === 'goal') return <GoalSlide goal={goal} onGoal={setGoal} />;
    const path = why?.paths.find(p => `reason:${p.key}` === key);
    return path && why ? <ReasonSlide path={path} stats={why.stats} /> : null;
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: c.bg }]}>
      <View style={styles.top}>
        <Text variant="overline" colour="brand">Zema German</Text>
        {index < last && (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Pressable accessibilityRole="button" accessibilityHint="Goes to choosing your daily goal" hitSlop={12} onPress={() => goTo(last)} style={[styles.skip, { backgroundColor: c.surface2 }]}>
              <Text variant="label" colour="muted">Skip</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={event => {
          if (!frozen) setFrozen(slides);
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
        }}>
        {slides.map(key => (
          <Slide key={key} width={width}>
            {render(key)}
          </Slide>
        ))}
      </Animated.ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots} accessible accessibilityLabel={`Page ${index + 1} of ${slides.length}`}>
          {slides.map((key, i) => (
            <Dot key={key} index={i} scroll={scroll} width={width} />
          ))}
        </View>
        <Button
          label={index === last ? 'Start learning' : 'Next'}
          icon={index === last ? 'rocket-launch-outline' : 'arrow-right'}
          kind={index === last ? 'gold' : 'primary'}
          onPress={() => (index === last ? finish() : goTo(index + 1))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, minHeight: 48 },
  skip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
  bottom: { padding: space.lg, gap: space.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  dot: { height: 8, borderRadius: radius.pill },
});
