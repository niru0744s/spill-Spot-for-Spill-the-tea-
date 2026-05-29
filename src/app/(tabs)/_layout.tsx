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

/* ── Design tokens ─────────────────────────────────────────── */
const C = {
  background:         '#0f150e',
  surface:            '#0f150e',
  surfaceContainer:   '#1b211a',
  primaryContainer:   '#96f996',
  onPrimaryContainer: '#037524',
  onSurfaceVariant:   '#becab9',
  outlineVariant:     '#3f4a3d',
};

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
                <MaterialIcons name={tab.icon} size={20} color="#037524" />
                <Text style={styles.activeLabel} numberOfLines={1}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity key={tab.name} onPress={onPress} activeOpacity={0.7} style={styles.inactiveWrapper}>
            <MaterialIcons name={tab.icon} size={22} color="#becab9" />
            <Text style={styles.inactiveLabel}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f150e' }}>
        <ActivityIndicator size="large" color="#96f996" />
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

const styles = StyleSheet.create({
  /* ── Custom tab bar ────────────────────────────────────────── */
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15,21,14,0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
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
    backgroundColor: '#96f996',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    gap: 5,
    maxWidth: '95%',          // never wider than its slot
    overflow: 'hidden',
    shadowColor: '#96f996',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  activeLabel: {
    color: '#037524',
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
    color: '#becab9',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
