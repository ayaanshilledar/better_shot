export const appleTokens = {
  colors: {
    primary: '#0066cc',
    primaryFocus: '#0071e3',
    primaryOnDark: '#2997ff',
    ink: '#1d1d1f',
    body: '#1d1d1f',
    bodyOnDark: '#ffffff',
    bodyMuted: '#cccccc',
    inkMuted80: '#333333',
    inkMuted48: '#7a7a7a',
    dividerSoft: '#f0f0f0',
    hairline: '#e0e0e0',
    canvas: '#ffffff',
    canvasParchment: '#f5f5f7',
    surfacePearl: '#fafafc',
    surfaceTile1: '#272729',
    surfaceTile2: '#2a2a2c',
    surfaceTile3: '#252527',
    surfaceBlack: '#000000',
    surfaceChipTranslucent: 'rgba(210, 210, 215, 0.18)',
    onPrimary: '#ffffff',
    onDark: '#ffffff',
    systemRed: '#ff3b30',
    systemGreen: '#34c759',
    systemOrange: '#ff9500'
  },
  typography: {
    heroDisplay: { fontSize: 56, fontWeight: 600, lineHeight: 1.07, letterSpacing: -0.28 },
    displayLg: { fontSize: 40, fontWeight: 600, lineHeight: 1.1, letterSpacing: 0 },
    displayMd: { fontSize: 34, fontWeight: 600, lineHeight: 1.47, letterSpacing: -0.374 },
    lead: { fontSize: 28, fontWeight: 400, lineHeight: 1.14, letterSpacing: 0.196 },
    tagline: { fontSize: 21, fontWeight: 600, lineHeight: 1.19, letterSpacing: 0.231 },
    bodyStrong: { fontSize: 17, fontWeight: 600, lineHeight: 1.24, letterSpacing: -0.374 },
    body: { fontSize: 17, fontWeight: 400, lineHeight: 1.47, letterSpacing: -0.374 },
    caption: { fontSize: 14, fontWeight: 400, lineHeight: 1.43, letterSpacing: -0.224 },
    captionStrong: { fontSize: 14, fontWeight: 600, lineHeight: 1.29, letterSpacing: -0.224 },
    buttonLarge: { fontSize: 18, fontWeight: 300, lineHeight: 1.0, letterSpacing: 0 },
    buttonUtility: { fontSize: 14, fontWeight: 400, lineHeight: 1.29, letterSpacing: -0.224 },
    finePrint: { fontSize: 12, fontWeight: 400, lineHeight: 1.0, letterSpacing: -0.12 },
    microLegal: { fontSize: 10, fontWeight: 400, lineHeight: 1.3, letterSpacing: -0.08 },
    navLink: { fontSize: 12, fontWeight: 400, lineHeight: 1.0, letterSpacing: -0.12 }
  },
  rounded: {
    none: '0px',
    xs: '5px',
    sm: '8px',
    md: '11px',
    lg: '18px',
    pill: '9999px',
    full: '9999px'
  },
  spacing: {
    xxs: '4px',
    xs: '8px',
    sm: '12px',
    md: '17px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
    section: '80px'
  },
  shadows: {
    product: '0 12px 36px rgba(0, 0, 0, 0.28), 0 4px 12px rgba(0, 0, 0, 0.18)',
    modal: '0 28px 72px rgba(0, 0, 0, 0.65), 0 8px 24px rgba(0, 0, 0, 0.35)'
  }
} as const;

export type AppleTokens = typeof appleTokens;
