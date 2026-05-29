/**
 * (tabs)/community.tsx — Coming Soon placeholder
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CommunityScreen() {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconWrapper, { transform: [{ translateY: floatAnim }] }]}>
        <MaterialIcons name="group" size={56} color="#ffb59c" />
      </Animated.View>
      <Text style={styles.title}>Community</Text>
      <Text style={styles.subtitle}>Coming soon — join circles, groups,{'\n'}and spill together 🫖</Text>
      <View style={styles.pill}>
        <Text style={styles.pillText}>COMING SOON</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f150e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,181,156,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,181,156,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#becab9',
    textAlign: 'center',
    lineHeight: 22,
  },
  pill: {
    marginTop: 8,
    backgroundColor: 'rgba(255,181,156,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,181,156,0.25)',
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  pillText: {
    color: '#ffb59c',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
