/**
 * (tabs)/_layout.tsx
 * -------------------
 * Redesigned tabs matching the Stitch dashboard design.
 * 4 tabs: Inbox (chats), Explore, Community, Profile
 * Custom bottom bar with matcha active pill, muted inactive items.
 */

import { Tabs } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useStyles } from '@/hooks/useTheme';
import { ThemeColors } from '@/types/theme';

/* ── Tab definitions ───────────────────────────────────────── */
const TABS: {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}[] = [
  { name: 'chats',     label: 'Inbox',     icon: 'chat-bubble' },
  { name: 'explore',   label: 'Explore',   icon: 'explore' },
  { name: 'community', label: 'Community', icon: 'group' },
  { name: 'profile',   label: 'Profile',   icon: 'person' },
];

/* ── Custom bottom tab bar ─────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useStyles(getStyles);

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((tab, index) => {
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: state.routes[index]?.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(tab.name);
          }
        };

        if (focused) {
          return (
            <TouchableOpacity key={tab.name} onPress={onPress} activeOpacity={0.85} style={styles.activeWrapper}>
              <View style={styles.activePill}>
                <MaterialIcons name={tab.icon} size={20} color={C.onPrimaryContainer} />
                <Text style={styles.activeLabel} numberOfLines={1}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity key={tab.name} onPress={onPress} activeOpacity={0.7} style={styles.inactiveWrapper}>
            <MaterialIcons name={tab.icon} size={22} color={C.onSurfaceVariant} />
            <Text style={styles.inactiveLabel}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { isInitialized } = useAuth();
  const { colors: C } = useTheme();

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

function getStyles(C: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
  /* ── Custom tab bar ────────────────────────────────────────── */
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: isDark ? 'rgba(15,21,14,0.94)' : 'rgba(244,250,243,0.94)',
    borderTopWidth: 1,
    borderTopColor: C.outlineVariant,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 16,
    elevation: 20,
  },
  activeWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    gap: 5,
    maxWidth: '95%',          // never wider than its slot
    overflow: 'hidden',
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  activeLabel: {
    color: C.onPrimaryContainer,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,            // shrink text, never wrap
  },
  inactiveWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  inactiveLabel: {
    color: C.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
}
