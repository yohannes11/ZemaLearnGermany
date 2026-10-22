import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useColours } from '@/ui/theme';

/** Android draws these Material icons; iOS uses the matching SF Symbols. */
const icon = (name: keyof typeof MaterialCommunityIcons.glyphMap) => (
  <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name={name} />
);

/**
 * Four destinations, each with one job: Home (today's plan and progress), Words (vocabulary training), Lessons
 * (grammar, reading, listening) and Me (account and settings). Words and Lessons keep their own stacks, so going
 * back always stays within the section.
 */
export default function TabsLayout() {
  const c = useColours();
  return (
    <NativeTabs
      backgroundColor={c.surface}
      indicatorColor={c.brandSoft}
      iconColor={{ default: c.subtle, selected: c.brand }}
      // Every tab keeps its name on Android, not just the selected one: icons alone are guesswork.
      labelVisibilityMode="labeled"
      labelStyle={{ default: { color: c.subtle }, selected: { color: c.brand } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" src={icon('home-variant')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="words">
        <NativeTabs.Trigger.Label>Words</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="rectangle.on.rectangle.angled" src={icon('cards-outline')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lessons">
        <NativeTabs.Trigger.Label>Lessons</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="graduationcap.fill" src={icon('school-outline')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" src={icon('account-circle-outline')} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
