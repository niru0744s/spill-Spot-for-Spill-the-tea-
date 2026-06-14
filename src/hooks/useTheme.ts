import { useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { ThemeContext } from '@/context/ThemeContext';
import { ThemeColors } from '@/types/theme';

export function useTheme() {
  return useContext(ThemeContext);
}

export function useStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>, A extends any[]>(
  getStyles: (C: ThemeColors, isDark: boolean, ...args: A) => T,
  ...args: A
): T {
  const { colors, isDark } = useTheme();
  return useMemo(() => getStyles(colors, isDark, ...args), [colors, isDark, getStyles, ...args]); // eslint-disable-line react-hooks/exhaustive-deps
}
