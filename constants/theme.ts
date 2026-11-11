// MediFill Design System — Professional Medical Palette
// Clean, trustworthy teal + slate design language

export const Colors = {
  // Primary — Teal (medical, calming, professional)
  primary: '#0D9488',
  primaryLight: '#F0FDFA',
  primaryDark: '#0F766E',

  // Accent — Sky blue
  accent: '#0284C7',
  accentLight: '#E0F2FE',

  // Semantic
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  dangerDark: '#991B1B',

  // Neutrals
  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Text — Slate scale
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textTertiary: '#64748B',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  textOnDanger: '#991B1B',

  // Alert-specific
  alertBackground: '#FEF2F2',
  alertBorder: '#FECACA',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

export const Shadow = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const IconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const ComponentSize = {
  iconButton: 40,
  iconButtonRadius: 20,
  tabBarHeightIOS: 84,
  tabBarHeightAndroid: 64,
  searchBarHeight: 48,
  inputHeight: 48,
  buttonHeight: 50,
  avatarSm: 40,
  avatarMd: 56,
  avatarLg: 80,
} as const;
