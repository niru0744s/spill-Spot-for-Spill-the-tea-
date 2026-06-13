import { useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { ThemeContext } from '@/context/ThemeContext';
import { ThemeColors } from '@/types/theme';

export function useTheme() {
  return useContext(ThemeContext);
}

export function useStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  getStyles: (C: ThemeColors, isDark: boolean) => T
): T {
  const { colors, isDark } = useTheme();
  return useMemo(() => getStyles(colors, isDark), [colors, isDark, getStyles]);
}
