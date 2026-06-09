/**
 * (auth)/login.tsx
 * ----------------
 * Redesigned sign-in screen matching the Stitch "Tea – Welcome Back" design.
 *
 * Layout (pixel-perfect):
 *   - #0f150e bg + animated dual vortex (spinning radial-gradient layers)
 *   - Glassmorphic card: rgba(49,54,47,0.4), blur, rounded-3xl, outline border
 *   - "Tea" pill badge: matcha green bg, glowing border
 *   - "Welcome Back" bold headline + "Ready to spill?" subtitle
 *   - Email/Username input — alternate_email icon, pill, focus glow
 *   - Password input — lock icon + eye/eye-off toggle, pill, focus glow
 *   - "Forgot Password?" in peach (secondary), right-aligned
 *   - "Sign In" matcha CTA pill with green glow shadow
 *   - OR divider with lines
 *   - 2 ghost social buttons (public / devices icons)
 *   - "New here? Get the Tea" footer
 *   - Zoom-in scale entrance animation
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';

const { width, height } = Dimensions.get('window');

/* ── Design tokens ──────────────────────────────────────────── */
const C = {
  background:         '#0f150e',
  surfaceVariant:     '#31362f',
  cardBg:             'rgba(49,54,47,0.45)',
  cardBorder:         'rgba(137,148,133,0.22)',
  primaryContainer:   '#96f996',
  onPrimaryContainer: '#037524',
  primaryFixed:       '#96f996',
  primaryFixedDim:    '#7adc7d',
  secondary:          '#ffb59c',   // peach — Forgot Password
  onSurface:          '#dfe4d9',
  onSurfaceVariant:   '#becab9',
  outlineVariant:     '#3f4a3d',
  inputBg:            'rgba(49,54,47,0.3)',
  inputBorder:        'rgba(137,148,133,0.22)',
  inputFocusBorder:   '#96f996',
  white:              '#ffffff',
  errorText:          '#ef4444',
  errorBg:            'rgba(239,68,68,0.10)',
  errorBorder:        'rgba(239,68,68,0.25)',
};

/* ── Animated vortex background ─────────────────────────────── */
function VortexBackground() {
  const spin1 = useRef(new Animated.Value(0)).current;
  const spin2 = useRef(new Animated.Value(1)).current; // starts at 1 = 360deg reversed

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin1, {
        toValue: 1,
        duration: 25000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(spin2, {
        toValue: 0,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate1 = spin1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotate2 = spin2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const scale1  = spin1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] });
  const scale2  = spin2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.10, 1] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Layer 1 — matcha radial + conic tint */}
      <Animated.View
        style={[
          styles.vortexLayer1,
          { transform: [{ rotate: rotate1 }, { scale: scale1 }] },
        ]}
      />
      {/* Layer 2 — peach radial tint, reverse spin */}
      <Animated.View
        style={[
          styles.vortexLayer2,
          { transform: [{ rotate: rotate2 }, { scale: scale2 }] },
        ]}
      />
    </View>
  );
}

/* ── Pill input with focus glow ─────────────────────────────── */
function PillInput({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  rightSlot,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  rightSlot?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
      <MaterialIcons
        name={icon}
        size={22}
        color={focused ? C.primaryFixedDim : C.onSurfaceVariant}
        style={styles.inputIcon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(190,202,185,0.5)"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {rightSlot}
    </View>
  );
}

/* ── Main Login Screen ──────────────────────────────────────── */
export default function LoginScreen() {
  const router = useRouter();
  const { signIn, error: authError } = useAuth();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Zoom-in card entrance
  const cardScale   = useRef(new Animated.Value(0.88)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      setValidationError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setValidationError(null);
    const success = await signIn(email, password);
    setLoading(false);
    if (success) router.replace('/(tabs)/chats');
  }, [email, password, signIn, router]);

  const activeError = validationError || authError;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />

      {/* ── Vortex spinning background ──────────────────────── */}
      <VortexBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Glass card ──────────────────────────────────── */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ scale: cardScale }],
              },
            ]}
          >
            {/* ── Header ──────────────────────────────────── */}
            <View style={styles.header}>

              {/* "Tea" pill badge */}
              <View style={styles.teaPill}>
                <Text style={styles.teaPillText}>Tea</Text>
              </View>

              {/* Welcome Back */}
              <Text style={styles.headline}>Welcome Back</Text>
              <Text style={styles.subheadline}>Ready to spill?</Text>
            </View>

            {/* ── Form ────────────────────────────────────── */}
            <View style={styles.formSection}>

              {/* Error */}
              {activeError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{activeError}</Text>
                </View>
              )}

              {/* Inputs */}
              <View style={styles.inputsGroup}>
                <PillInput
                  icon="alternate-email"
                  placeholder="Email or Username"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />

                <PillInput
                  icon="lock-outline"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  rightSlot={
                    <TouchableOpacity
                      onPress={() => setShowPass(v => !v)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons
                        name={showPass ? 'visibility' : 'visibility-off'}
                        size={20}
                        color={C.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                  }
                />
              </View>

              {/* Forgot password */}
              <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Sign In CTA */}
              <TouchableOpacity
                style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.82}
              >
                {loading ? (
                  <ActivityIndicator color={C.onPrimaryContainer} />
                ) : (
                  <Text style={styles.ctaBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* OR divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social login ghost buttons */}
              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialBtn} activeOpacity={0.75}>
                  <MaterialIcons name="public" size={24} color={C.onSurface} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialBtn} activeOpacity={0.75}>
                  <MaterialIcons name="devices" size={24} color={C.onSurface} />
                </TouchableOpacity>
              </View>

            </View>

            {/* ── Footer ──────────────────────────────────── */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>New here? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')} activeOpacity={0.7}>
                <Text style={styles.footerLink}>Get the Tea</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
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

  /* ── Vortex layers ──────────────────────────────────────── */
  vortexLayer1: {
    position: 'absolute',
    // Oversized to cover full screen when rotating
    top: -height * 0.5,
    left: -width * 0.5,
    width: width * 2,
    height: height * 2,
    borderRadius: width,
    // Matcha green radial center glow
    backgroundColor: 'transparent',
    // Simulate radial via large shadow
    shadowColor: '#96f996',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: width * 0.6,
    // Inner accent via border
    borderWidth: 1,
    borderColor: 'rgba(150,249,150,0.06)',
  },
  vortexLayer2: {
    position: 'absolute',
    top: -height * 0.3,
    left: -width * 0.3,
    width: width * 1.6,
    height: height * 1.6,
    borderRadius: width,
    backgroundColor: 'transparent',
    shadowColor: '#ffb59c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: width * 0.5,
    borderWidth: 1,
    borderColor: 'rgba(255,181,156,0.04)',
  },

  /* ── Glass card ─────────────────────────────────────────── */
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: C.cardBg,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 28,
    paddingVertical: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
    gap: 32,
  },

  /* ── Header ─────────────────────────────────────────────── */
  header: {
    alignItems: 'center',
    gap: 10,
  },

  /* Tea pill */
  teaPill: {
    backgroundColor: C.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(150,249,150,0.5)',
    shadowColor: '#96f996',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 4,
  },
  teaPillText: {
    color: C.onPrimaryContainer,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  headline: {
    fontSize: 36,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -1,
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 18,
    fontWeight: '400',
    color: C.onSurfaceVariant,
    textAlign: 'center',
  },

  /* ── Form section ───────────────────────────────────────── */
  formSection: {
    gap: 16,
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
  },
  inputRowFocused: {
    borderColor: C.inputFocusBorder,
    backgroundColor: 'rgba(49,54,47,0.5)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: C.onSurface,
    padding: 0,
  },

  /* Forgot password */
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    color: C.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
    shadowRadius: 22,
    elevation: 10,
  },
  ctaBtnDisabled: {
    opacity: 0.7,
  },
  ctaBtnText: {
    color: C.onPrimaryContainer,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* OR divider */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    opacity: 0.6,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.outlineVariant,
  },
  dividerText: {
    color: C.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  /* Social buttons */
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -8,
  },
  footerText: {
    color: C.onSurfaceVariant,
    fontSize: 15,
    fontWeight: '400',
  },
  footerLink: {
    color: C.primaryFixedDim,
    fontSize: 15,
    fontWeight: '700',
  },
});
