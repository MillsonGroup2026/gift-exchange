import {
  Baby,
  Book,
  Coffee,
  CreditCard,
  Dumbbell,
  Footprints,
  Gamepad2,
  Gift,
  Headphones,
  Home,
  Palette,
  PawPrint,
  Plane,
  Shirt,
  ShoppingBag,
  Smartphone,
  Ticket,
  Utensils,
  Watch,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// Guess a category icon from the item's name. First match wins; falls back to a gift.
const RULES: [RegExp, LucideIcon][] = [
  [/cloth|shirt|jacket|sweater|hoodie|jersey|jean|pant|dress|sock|apparel|coat|wear\b/i, Shirt],
  [/shoe|sneaker|boot|footwear|cleat|running/i, Footprints],
  [/phone|iphone|android|pixel|galaxy|tablet|ipad|laptop|computer|monitor|\btv\b|console|charger|electronic/i, Smartphone],
  [/watch|jewel|ring|necklace|bracelet|earring/i, Watch],
  [/game|board|lawn|xbox|playstation|nintendo|switch|puzzle|lego/i, Gamepad2],
  [/book|read|novel|kindle|journal/i, Book],
  [/head.?phone|earbud|airpod|speaker|audio|\bmusic\b|vinyl|record/i, Headphones],
  [/coffee|espresso|\btea\b|mug/i, Coffee],
  [/kitchen|cook|\bpan\b|knife|blender|bake|utensil|plate|dish|grill/i, Utensils],
  [/gift.?card|\bcard\b/i, CreditCard],
  [/tool|drill|wrench|hardware|garage/i, Wrench],
  [/gym|weight|fitness|workout|dumbbell|yoga|sport/i, Dumbbell],
  [/home|decor|blanket|throw|pillow|candle|furniture|lamp|bedding/i, Home],
  [/baby|kid|toddler|infant|nursery/i, Baby],
  [/\bpet\b|\bdog\b|\bcat\b/i, PawPrint],
  [/\bart\b|paint|craft|draw|color/i, Palette],
  [/ticket|concert|event|experience|show/i, Ticket],
  [/travel|trip|luggage|vacation|flight|suitcase/i, Plane],
  [/\bbag\b|purse|backpack|wallet|tote/i, ShoppingBag],
];

export function iconForTitle(title: string): LucideIcon {
  const t = title ?? "";
  for (const [re, Icon] of RULES) if (re.test(t)) return Icon;
  return Gift;
}

export function ItemIcon({ title, className }: { title: string; className?: string }) {
  const Icon = iconForTitle(title);
  return <Icon className={className} aria-hidden="true" />;
}
