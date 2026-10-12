export const palette = {
  bgTop: '#0B3D2A',
  bgMid: '#0F6B4A',
  bgBottom: '#137C7A',
  lime: '#D4F34A',
  mint: '#5EEAD4',
  ink: '#0F1A14',
  white: '#FFFFFF',
  muted: 'rgba(255,255,255,0.72)',
  faint: 'rgba(255,255,255,0.5)',
  danger: '#FF8A8A',
  warn: '#FFD58A',
};

export const glass = {
  fill: 'rgba(255,255,255,0.14)',
  fillStrong: 'rgba(255,255,255,0.22)',
  border: 'rgba(255,255,255,0.35)',
  radius: 24,
  innerRadius: 16,
  blurIntensity: 40,
};

export const type = {
  brand: { fontSize: 22, fontWeight: '700' as const, color: palette.white },
  h1: { fontSize: 28, fontWeight: '700' as const, color: palette.white },
  h2: { fontSize: 18, fontWeight: '600' as const, color: palette.white },
  h3: { fontSize: 15, fontWeight: '600' as const, color: palette.white },
  body: { fontSize: 15, fontWeight: '400' as const, color: palette.white },
  caption: { fontSize: 13, fontWeight: '500' as const, color: palette.muted },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
    color: palette.lime,
  },
  link: { fontSize: 14, fontWeight: '600' as const, color: palette.lime },
  error: { fontSize: 13, fontWeight: '500' as const, color: palette.danger },
};
