import { Tabs } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';

export default function TabLayout() {
  const { isInitialized } = useAuth();

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F2027' }}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a2c35',
          borderTopColor: 'rgba(255,255,255,0.1)',
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#8aa6b5',
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          // Note: using built-in unicode icons for now until vector icons are installed
          tabBarIcon: () => <></>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: () => <></>,
        }}
      />
    </Tabs>
  );
}
