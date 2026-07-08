/**
 * Platform-agnostic icon keys stored in Service.icon.
 * Each surface maps a key to its own icon set:
 *   mobile apps → @expo/vector-icons MaterialCommunityIcons
 *   admin web   → lucide-react
 */
export const ICON_KEYS = [
  'dishes', 'kitchen', 'chef', 'broom', 'duster',
  'shower', 'laundry', 'iron', 'plant', 'window',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export const DEFAULT_ICON_KEY: IconKey = 'broom';
