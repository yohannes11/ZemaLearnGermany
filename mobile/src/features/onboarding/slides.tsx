import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import type { WhyGerman } from '@/core/api/types';
import type { Lang } from '@/core/course';
import { DAILY_GOALS } from '@/features/gamification/xp';
import { Badge, Icon, Text, type IconName } from '@/ui/primitives';
import { radius, space, useColours, useRipple } from '@/ui/theme';

/** Each slide scrolls on its own, so nothing is cut off on small phones or with large text. */
export function Slide({ width, children }: { width: number; children: ReactNode }) {
  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.slide} persistentScrollbar>
      {children}
    </ScrollView>
  );
}

function Choice({ selected, onPress, children, label }: { selected: boolean; onPress: () => void; children: ReactNode; label: string }) {
  const c = useColours();
  const rippleConfig = useRipple();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      android_ripple={rippleConfig}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.choice,
        { overflow: 'hidden' },
        { backgroundColor: selected ? c.brandSoft : c.surface, borderColor: selected ? c.brand : c.border, borderBottomColor: selected ? c.brand : c.borderStrong },
      ]}>
      {children}
    </Pressable>
  );
}

export function WelcomeSlide({ lang, onLang }: { lang: Lang; onLang: (lang: Lang) => void }) {
  const c = useColours();
  return (
    <>
      <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.hero, { backgroundColor: c.brand }]}>
        <Text variant="display" style={{ color: c.brandInk }}>Hallo!</Text>
        <View style={[styles.weave, { backgroundColor: c.goldBright }]} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(150)} style={styles.stack}>
        <Text variant="title">Learn German, a few minutes a day</Text>
        <Text colour="muted">
          Real recordings, short lessons and a streak that keeps you going. Made for Amharic and English speakers.
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(300)} style={styles.stack} accessibilityRole="radiogroup">
        <Text variant="label">Explanations in</Text>
        <View style={styles.row}>
          {([['en', 'English'], ['am', 'አማርኛ']] as const).map(([code, name]) => (
            <Choice key={code} selected={lang === code} onPress={() => onLang(code)} label={name}>
              <Text variant="subheading" style={styles.centre}>{name}</Text>
            </Choice>
          ))}
        </View>
      </Animated.View>
    </>
  );
}

export function ReasonSlide({ path, stats }: { path: WhyGerman['paths'][number]; stats: WhyGerman['stats'] }) {
  const c = useColours();
  const source = path.sources[0];
  return (
    <>
      {path.image && (
        <Animated.View entering={FadeInDown} style={styles.photoFrame}>
          <Image
            source={path.image.url}
            style={styles.photo}
            contentFit="cover"
            cachePolicy="disk"
            transition={250}
            accessibilityIgnoresInvertColors
          />
          <Text variant="caption" style={[styles.credit, { color: c.onImage }]}>Photo: {path.image.credit}</Text>
        </Animated.View>
      )}
      <Text variant="heading">{path.title}</Text>
      <View style={styles.row}>
        {path.stats.map(i => stats[i]).filter(Boolean).map((stat, i) => (
          <Animated.View
            key={stat.label}
            entering={FadeInDown.delay(120 + i * 100)}
            style={[styles.stat, { backgroundColor: c.goldSoft }]}
            accessible
            accessibilityLabel={`${stat.display} ${stat.label}`}>
            <Text variant="heading" style={{ color: c.xp, fontSize: 24, lineHeight: 30 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {stat.display}
            </Text>
            <Text variant="caption">{stat.label}</Text>
          </Animated.View>
        ))}
      </View>
      <Text colour="muted">{path.body}</Text>
      {path.needs ? (
        <View style={[styles.needs, { backgroundColor: c.brandSoft }]}>
          <Icon name="school-outline" size={18} colour={c.brand} />
          <Text variant="label" style={{ color: c.brand, flexShrink: 1 }}>{path.needs}</Text>
        </View>
      ) : null}
      {source && (
        <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(source.url)} hitSlop={8}>
          <Text variant="caption" colour="subtle">
            Source: {source.publisher}, {source.date} ›
          </Text>
        </Pressable>
      )}
    </>
  );
}

function Feature({ icon, colour, background, title, body }: { icon: IconName; colour: string; background: string; title: string; body: string }) {
  const c = useColours();
  return (
    <View style={[styles.feature, { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: colour }]}>
      <Badge icon={icon} colour={colour} background={background} />
      <View style={styles.featureText}>
        <Text variant="subheading">{title}</Text>
        <Text variant="caption" colour="muted">{body}</Text>
      </View>
    </View>
  );
}

export function HowSlide() {
  const c = useColours();
  return (
    <>
      <Text variant="title">Two ways to learn, one streak</Text>
      <Animated.View entering={FadeInDown.delay(100)}>
        <Feature icon="cards-outline" colour={c.xp} background={c.goldSoft} title="Words" body="Flashcards with real recordings and pictures. Smart review brings each word back just before you forget it." />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(200)}>
        <Feature icon="school-outline" colour={c.brand} background={c.brandSoft} title="Lessons" body="Short grammar lessons, reading texts and listening practice, with exercises that check you right away." />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(300)} style={styles.row}>
        {[
          { icon: 'fire' as const, colour: c.flame, background: c.flameSoft, text: 'Keep a daily streak' },
          { icon: 'lightning-bolt' as const, colour: c.xp, background: c.goldSoft, text: 'Earn XP for every answer' },
          { icon: 'shield-star' as const, colour: c.brand, background: c.brandSoft, text: 'Level up as you go' },
        ].map(item => (
          <View key={item.text} style={styles.perk}>
            <Badge icon={item.icon} colour={item.colour} background={item.background} />
            <Text variant="caption" style={styles.centre}>{item.text}</Text>
          </View>
        ))}
      </Animated.View>
    </>
  );
}

export function GoalSlide({ goal, onGoal }: { goal: number; onGoal: (xp: number) => void }) {
  return (
    <>
      <Text variant="title">Pick a daily goal</Text>
      <Text colour="muted">You can change it any time under Me. Small and steady wins.</Text>
      <View style={styles.stack} accessibilityRole="radiogroup">
        {DAILY_GOALS.map((option, i) => (
          <Animated.View key={option.xp} entering={FadeInDown.delay(80 * i)}>
            <Choice selected={goal === option.xp} onPress={() => onGoal(option.xp)} label={`${option.name}, ${option.time}, ${option.xp} XP`}>
              <View style={styles.goalRow}>
                <Text variant="subheading" style={styles.grow}>{option.name}</Text>
                <Text variant="caption" colour="muted">{option.time}</Text>
                <Text variant="label" colour="xp">{option.xp} XP</Text>
              </View>
            </Choice>
          </Animated.View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  slide: { padding: space.lg, gap: space.md, flexGrow: 1, justifyContent: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { height: 180, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  weave: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 10 },
  stack: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  centre: { textAlign: 'center' },
  grow: { flex: 1 },
  choice: { flex: 1, minHeight: 56, borderWidth: 1.5, borderBottomWidth: 4, borderRadius: radius.lg, padding: space.md, justifyContent: 'center' },
  photoFrame: { borderRadius: radius.xl, overflow: 'hidden' },
  // Short enough that the reason, its requirement and its source fit below without scrolling.
  photo: { width: '100%', height: 140 },
  credit: { position: 'absolute', right: space.sm, bottom: space.xs, fontSize: 10, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  stat: { flex: 1, paddingHorizontal: space.md, paddingVertical: space.sm + 4, borderRadius: radius.lg, gap: 2 },
  needs: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
  featureText: { flex: 1, gap: 2 },
  perk: { flex: 1, alignItems: 'center', gap: space.sm },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
