import {
  Utensils, CookingPot, ChefHat, Brush, SprayCan, ShowerHead,
  WashingMachine, Shirt, Flower2, AppWindow, type LucideIcon,
} from 'lucide-react';

/** Service icon-key → lucide glyph (keys match the mobile apps' map). */
const MAP: Record<string, LucideIcon> = {
  dishes: Utensils,
  kitchen: CookingPot,
  chef: ChefHat,
  broom: Brush,
  duster: SprayCan,
  shower: ShowerHead,
  laundry: WashingMachine,
  iron: Shirt,
  plant: Flower2,
  window: AppWindow,
};

export function ServiceIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = MAP[icon] ?? Brush;
  return <Icon size={size} style={{ verticalAlign: 'text-bottom' }} />;
}
