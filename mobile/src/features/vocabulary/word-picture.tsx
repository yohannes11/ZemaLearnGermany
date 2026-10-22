import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { pictureUrl } from '@/core/offline/audio';

/** A word's picture: one or more emoji (compound words show their parts). Kept on disk once seen. */
export function WordPicture({ codes, size }: { codes?: string[]; size: number }) {
  const urls = (codes ?? []).map(pictureUrl).filter((url): url is string => !!url);
  if (!urls.length) return null;
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {urls.map(url => (
        <Image key={url} source={url} style={{ width: size, height: size }} contentFit="contain" cachePolicy="disk" transition={150} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 6 } });
