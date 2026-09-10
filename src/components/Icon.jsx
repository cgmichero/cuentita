import {
  Utensils, ShoppingCart, Car, Bus, PartyPopper, Gamepad2, Zap, Receipt,
  HeartPulse, Stethoscope, GraduationCap, Home, Plane, Gift, Dumbbell,
  PawPrint, Wifi, Smartphone, Shirt, Coffee, Baby, Package, Fuel,
  Wrench, Film, Music, Book, Sparkles,
} from "lucide-react";

export const ICONS = {
  Utensils, ShoppingCart, Car, Bus, PartyPopper, Gamepad2, Zap, Receipt,
  HeartPulse, Stethoscope, GraduationCap, Home, Plane, Gift, Dumbbell,
  PawPrint, Wifi, Smartphone, Shirt, Coffee, Baby, Package, Fuel,
  Wrench, Film, Music, Book, Sparkles,
};
export const ICON_NAMES = Object.keys(ICONS);

export default function Icon({ name, ...props }) {
  const Cmp = ICONS[name] || Package;
  return <Cmp {...props} />;
}
