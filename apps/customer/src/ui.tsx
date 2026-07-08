import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

/**
 * Design tokens — Pronto design system.
 * Primary #E6007E · soft pink tints for icon chips · green reserved for money ·
 * white surfaces, thin borders, no shadows · 16–24px radii, pill buttons.
 */
export const C = {
  bg: '#FFFFFF',
  soft: '#FAFAFA',        // input fills / subtle surfaces
  card: '#FFFFFF',
  border: '#F0F0F0',
  text: '#1A1A1A',
  muted: '#6B6B6B',
  accent: '#E6007E',      // brand pink
  tint: '#FDE9F3',        // ~10% pink — icon chips, selected states
  green: '#0BA05A',       // earnings / positive value only
  greenTint: '#E7F7EF',
  amber: '#B45309',
  amberTint: '#FEF3C7',
  red: '#DC2626',
  redTint: '#FEE2E2',
  black: '#1A1A1A',       // high-emphasis CTA
};

export function Btn({ title, onPress, kind = 'primary', disabled, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        s.btn,
        kind === 'ghost' && s.btnGhost,
        kind === 'danger' && { backgroundColor: C.red },
        disabled && { opacity: 0.4 },
        style,
      ]}>
      <Text style={[s.btnText, kind === 'ghost' && { color: C.accent }]}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Circular soft-tinted container — every icon sits in one of these. */
export function IconCircle({ children, size = 44, color = C.tint, style }: {
  children: React.ReactNode; size?: number; color?: string; style?: ViewStyle;
}) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }, style]}>
      {children}
    </View>
  );
}

/** Small pill badge for numeric values / statuses. */
export function Pill({ label, color = C.accent, bg = C.tint }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.accent} />
    </View>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 12, letterSpacing: -0.3 }}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[{ color: C.muted, fontSize: 13, lineHeight: 18 }, style]}>{children}</Text>;
}

const s = StyleSheet.create({
  btn: {
    backgroundColor: C.black,
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.accent,
  },
  btnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
});
