import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { space, useColours } from './theme';

type ScreenProps = { children: ReactNode; edges?: Edge[]; scroll?: boolean; header?: ReactNode };

/** A page on the brand background, clear of the notch and the tab bar, at most 720pt wide on tablets. */
export function Screen({ children, edges = ['top'], scroll = true, header }: ScreenProps) {
  const c = useColours();
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: c.bg }]}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xxl * 2, maxWidth: 720, width: '100%', alignSelf: 'center' },
});
