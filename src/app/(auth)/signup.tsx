/**
 * (auth)/signup.tsx
 * -----------------
 * Redesigned signup screen matching the Stitch "Tea – Join the Circle" design.
 *
 * Layout:
 *   - Deep charcoal (#0f150e) background with animated liquid matcha drops
 *   - Glassmorphic card (rounded-xl, white border, backdrop blur via shadow)
 *   - Tea logo (cup + peach badge) + italic "Tea" wordmark
 *   - "Join the Circle" headline
 *   - 4 pill inputs: Full Name, @username, Email, Password (with icons)
 *   - "Start Spilling" matcha CTA with green glow
 *   - "Already part of the circle? Sign In" footer
 *   - Staggered fade-in-up entrance animation for each element
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

const { width, height } = Dimensions.get('window');

/* ── Design tokens ─────────────────────────────────────────── */
const C = {
  background:         '#0f150e',
  surface:            '#1b211a',
  surfaceCard:        'rgba(255,255,255,0.04)',
  cardBorder:         'rgba(255,255,255,0.10)',
  primaryContainer:   '#96f996',   // matcha green
  onPrimaryContainer: '#037524',   // dark text on matcha
  primaryFixedDim:    '#7adc7d',
  secondary:          '#ffb59c',   // peach badge
  onSecondary:        '#5c1a00',
  onSurface:          '#dfe4d9',
  onSurfaceVariant:   '#becab9',
  inputBg:            'rgba(255,255,255,0.05)',
  inputBorder:        'rgba(255,255,255,0.08)',
  inputFocusBorder:   'rgba(150,249,150,0.45)',
  inputFocusShadow:   'rgba(150,249,150,0.12)',
  errorBg:            'rgba(239,68,68,0.10)',
  errorBorder:        'rgba(239,68,68,0.25)',
  errorText:          '#ef4444',
  white:              '#ffffff',
};

/* ── Animated liquid drop blob ─────────────────────────────── */
function LiquidBlob({ delay, x, size }: { delay: number; x: number; size: number }) {
  const y = useRef(new Animated.Value(-size)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const targetY = height * 0.75 + Math.random() * 80;
    const startDelay = delay + Math.random() * 2000;

    const loop = () => {
      y.setValue(-size);
      opacity.setValue(0);

      Animated.sequence([
        Animated.delay(startDelay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.18, duration: 400, useNativeDriver: true }),
          Animated.timing(y, {
            toValue: targetY,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start(() => loop());
    };

    loop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#037524',
        opacity,
        transform: [{ translateY: y }],
      }}
      pointerEvents="none"
    />
  );
}

/* ── Mini coffee-cup logo (same as landing) ────────────────── */
function CupLogo() {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -6, duration: 500, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0,  duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.logoWrapper}>
      <View style={styles.cupOuter}>
        <View style={styles.cupRim} />
        <View style={styles.cupRow}>
          <View style={styles.cupBody} />
          <View style={styles.cupHandle} />
        </View>
        <View style={styles.cupSaucer} />
      </View>
      <Animated.View style={[styles.badge, { transform: [{ translateY: bounce }] }]}>
        <Text style={styles.badgeText}>!!!</Text>
      </Animated.View>
    </View>
  );
}

/* ── Glassy input field ────────────────────────────────────── */
function GlassInput({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  delay,
}: {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  delay: number;
}) {
  const [focused, setFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
        ]}
      >
        <Text style={[styles.inputIcon, focused && styles.inputIconFocused]}>{icon}</Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.28)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </Animated.View>
  );
}

/* ── Main Signup Screen ────────────────────────────────────── */
export default function SignupScreen() {
  const router = useRouter();
  const { signUp, error: authError } = useAuth();

  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Entrance animations
  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(40)).current;
  const cardFade    = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(40)).current;
  const btnFade     = useRef(new Animated.Value(0)).current;
  const btnSlide    = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(headerFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(headerSlide, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(cardSlide, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(btnSlide, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleSignup = async () => {
    if (!name || !username || !email || !password) {
      setValidationError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setValidationError(null);
    const success = await signUp(email, password, username, name);
    setLoading(false);

    if (success) {
      router.replace('/(tabs)/chats');
    }
  };

  const activeError = validationError || authError;

  // Pre-compute blob positions
  const blobs = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      x: Math.random() * (width - 60),
      size: 50 + Math.random() * 70,
      delay: i * 400,
    }))
  ).current;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />

      {/* ── Liquid drop blobs ──────────────────────────────── */}
      {blobs.map((b, i) => (
        <LiquidBlob key={i} x={b.x} size={b.size} delay={b.delay} />
      ))}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Glass card ────────────────────────────────── */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardFade,
                transform: [{ translateY: cardSlide }],
              },
            ]}
          >
            {/* Logo section */}
            <Animated.View
              style={[
                styles.logoSection,
                { opacity: headerFade, transform: [{ translateY: headerSlide }] },
              ]}
            >
              <CupLogo />
              <Text style={styles.brandName}>Tea</Text>
            </Animated.View>

            {/* Header */}
            <Animated.View
              style={[
                styles.headerSection,
                { opacity: headerFade, transform: [{ translateY: headerSlide }] },
              ]}
            >
              <Text style={styles.headline}>Join the Circle</Text>
              <Text style={styles.subheadline}>Your portal to the inner circle awaits.</Text>
            </Animated.View>

            {/* Error box */}
            {activeError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{activeError}</Text>
              </View>
            )}

            {/* Inputs */}
            <View style={styles.inputsGroup}>
              <GlassInput
                icon="👤"
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                delay={800}
              />
              <GlassInput
                icon="@"
                placeholder="@username"
                value={username}
                onChangeText={setUsername}
                delay={900}
              />
              <GlassInput
                icon="✉"
                placeholder="Email Address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                delay={1000}
              />
              <GlassInput
                icon="🔒"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                delay={1100}
              />
            </View>

            {/* CTA button */}
            <Animated.View style={{ opacity: btnFade, transform: [{ translateY: btnSlide }] }}>
              <TouchableOpacity
                style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.82}
              >
                {loading ? (
                  <ActivityIndicator color={C.onPrimaryContainer} />
                ) : (
                  <Text style={styles.ctaBtnText}>Start Spilling</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Footer */}
            <Animated.View style={[styles.footer, { opacity: btnFade }]}>
              <Text style={styles.footerText}>Already part of the circle?</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
                <Text style={styles.footerLink}> Sign In</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* Bottom tagline */}
          <Text style={styles.tagline}>PRIVATE  •  SECURE  •  AESTHETIC</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ── StyleSheet ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },

  /* Glass card */
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: C.surfaceCard,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 40 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 20,
    gap: 20,
  },

  /* Logo */
  logoSection: {
    alignItems: 'center',
    gap: 4,
  },
  logoWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cupOuter: {
    alignItems: 'center',
  },
  cupRim: {
    width: 52,
    height: 6,
    backgroundColor: C.primaryFixedDim,
    borderRadius: 3,
    marginBottom: 2,
  },
  cupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cupBody: {
    width: 46,
    height: 32,
    backgroundColor: C.primaryFixedDim,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  cupHandle: {
    width: 12,
    height: 20,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: C.primaryFixedDim,
    backgroundColor: 'transparent',
    marginLeft: -2,
    marginTop: 4,
  },
  cupSaucer: {
    width: 58,
    height: 5,
    backgroundColor: C.primaryFixedDim,
    borderRadius: 3,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.background,
  },
  badgeText: {
    color: C.onSecondary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    fontStyle: 'italic',
    color: C.white,
    letterSpacing: -1.5,
    marginTop: -4,
  },

  /* Header */
  headerSection: {
    alignItems: 'center',
    gap: 6,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 15,
    fontWeight: '400',
    color: C.onSurfaceVariant,
    textAlign: 'center',
    opacity: 0.85,
  },

  /* Error */
  errorBox: {
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.errorBorder,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  errorText: {
    color: C.errorText,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  /* Inputs */
  inputsGroup: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  inputRowFocused: {
    borderColor: C.inputFocusBorder,
    backgroundColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#96f996',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  inputIcon: {
    fontSize: 18,
    color: C.onSurfaceVariant,
    width: 22,
    textAlign: 'center',
  },
  inputIconFocused: {
    color: C.primaryFixedDim,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: C.white,
    padding: 0,
  },

  /* CTA */
  ctaBtn: {
    width: '100%',
    backgroundColor: C.primaryContainer,
    paddingVertical: 17,
    borderRadius: 9999,
    alignItems: 'center',
    shadowColor: '#96f996',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
    marginTop: 4,
  },
  ctaBtnDisabled: {
    opacity: 0.7,
  },
  ctaBtnText: {
    color: C.onPrimaryContainer,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  footerText: {
    color: C.onSurfaceVariant,
    fontSize: 15,
    fontWeight: '400',
  },
  footerLink: {
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
  },

  /* Bottom tagline */
  tagline: {
    marginTop: 28,
    color: C.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    opacity: 0.35,
    textAlign: 'center',
  },
});
