import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DEFAULT_ICON_KEY } from '@pronto/shared';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Service icon-key → MaterialCommunityIcons glyph. */
const SERVICE_ICONS: Record<string, MCIName> = {
  dishes: 'silverware-clean',
  kitchen: 'countertop',
  chef: 'chef-hat',
  broom: 'broom',
  duster: 'spray-bottle',
  shower: 'shower-head',
  laundry: 'washing-machine',
  iron: 'iron-outline',
  plant: 'flower-outline',
  window: 'window-closed-variant',
};

export function ServiceIcon({ icon, size = 26, color }: { icon: string; size?: number; color?: string }) {
  return (
    <MaterialCommunityIcons
      name={SERVICE_ICONS[icon] ?? SERVICE_ICONS[DEFAULT_ICON_KEY]}
      size={size}
      color={color ?? '#E6007E'}
    />
  );
}

export { MaterialCommunityIcons as MCI };
export { Ionicons } from '@expo/vector-icons';
