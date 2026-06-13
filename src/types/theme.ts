export interface ThemeColors {
  background: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  primaryContainer: string;
  primaryFixed: string;
  primaryFixedDim: string;
  onPrimaryFixed: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  onSecondary: string;
  secondaryFixed: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
  errorColor: string;
  white: string;

  // Compatibility tokens for legacy component structures
  surface: string;
  surfaceHigh: string;
  surfaceVariant: string;
  primary: string;
  primaryDim: string;
  outline: string;

  // Custom component-specific styling overlays
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  inputFocusBorder: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  surfaceCard: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
