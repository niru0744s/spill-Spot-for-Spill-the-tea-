import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '@/services/mmkv';
import { ThemeColors, ThemeMode } from '@/types/theme';

export const MatchaDark: ThemeColors = {
  background: '#0f150e',
  surfaceContainer: '#1b211a',
  surfaceContainerHigh: '#262b24',
  surfaceContainerHighest: '#31362f',
  primaryContainer: '#96f996',
  primaryFixed: '#96f996',
  primaryFixedDim: '#7adc7d',
  onPrimaryFixed: '#002105',
  onPrimaryContainer: '#037524',
  secondary: '#ffb59c',
  secondaryContainer: '#8e2c01',
  onSecondary: '#ffb59c',
  secondaryFixed: '#ffb59c',
  onSurface: '#dfe4d9',
  onSurfaceVariant: '#becab9',
  outlineVariant: '#3f4a3d',
  errorColor: '#ff6b6b',
  white: '#ffffff',
  surface: '#1b211a',
  surfaceHigh: '#262b24',
  surfaceVariant: '#31362f',
  primary: '#96f996',
  primaryDim: '#7adc7d',
  outline: '#899485',
  cardBg: 'rgba(49,54,47,0.45)',
  cardBorder: 'rgba(137,148,133,0.22)',
  inputBg: 'rgba(49,54,47,0.3)',
  inputBorder: 'rgba(137,148,133,0.22)',
  inputFocusBorder: '#96f996',
  errorBg: 'rgba(239,68,68,0.10)',
  errorBorder: 'rgba(239,68,68,0.25)',
  errorText: '#ef4444',
  surfaceCard: '#1b211a',
};

export const MatchaLight: ThemeColors = {
  background: '#f4faf3',
  surfaceContainer: '#eaf2e8',
  surfaceContainerHigh: '#dbe6d8',
  surfaceContainerHighest: '#cbd9c7',
  primaryContainer: '#2ea847',
  primaryFixed: '#0f3a14',
  primaryFixedDim: '#2ea847',
  onPrimaryFixed: '#ffffff',
  onPrimaryContainer: '#ffffff',
  secondary: '#e0653d',
  secondaryContainer: '#ffe6db',
  onSecondary: '#ffffff',
  secondaryFixed: '#e0653d',
  onSurface: '#0e180d',
  onSurfaceVariant: '#4b5747',
  outlineVariant: '#c4d1bf',
  errorColor: '#d32f2f',
  white: '#ffffff',
  surface: '#eaf2e8',
  surfaceHigh: '#dbe6d8',
  surfaceVariant: '#cbd9c7',
  primary: '#2ea847',
  primaryDim: '#46b45b',
  outline: '#748070',
  cardBg: 'rgba(234,242,232,0.65)',
  cardBorder: 'rgba(196,209,191,0.4)',
  inputBg: 'rgba(234,242,232,0.4)',
  inputBorder: 'rgba(196,209,191,0.4)',
  inputFocusBorder: '#2ea847',
  errorBg: 'rgba(211,47,47,0.08)',
  errorBorder: 'rgba(211,47,47,0.2)',
  errorText: '#d32f2f',
  surfaceCard: '#eaf2e8',
};

interface ThemeContextProps {
  colors: ThemeColors;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextProps>({
  colors: MatchaDark,
  themeMode: 'system',
  isDark: true,
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (storage.getString('theme_mode') as ThemeMode) || 'system';
  });

  const getIsDark = (mode: ThemeMode): boolean => {
    if (mode === 'system') {
      return systemScheme === 'dark';
    }
    return mode === 'dark';
  };

  const isDark = getIsDark(themeMode);
  const colors = isDark ? MatchaDark : MatchaLight;

  const setThemeMode = (mode: ThemeMode) => {
    storage.set('theme_mode', mode);
    setThemeModeState(mode);
  };

  return (
    <ThemeContext.Provider value={{ colors, themeMode, isDark, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
