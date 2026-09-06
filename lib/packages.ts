/**
 * Package definitions for the enquiry flow.
 *
 * Each package has a tier (basic / standard / premium), a name, a per-project
 * price, a short description of what's included, and a longer breakdown.
 * The packages page renders these as a Server Component shell and the client
 * selection layer picks one (or more) to pre-fill a WhatsApp message.
 */

export type PackageTier = "basic" | "standard" | "premium";

export interface PackageDef {
  /** Unique id used for selection state and the WhatsApp message builder. */
  id: string;
  /** Human label for the pricing tier pill. */
  tier: PackageTier;
  name: string;
  price: string;
  tagline: string;
  includes: string[];
  /** Short paragraph shown under the package title on the packages page. */
  description: string;
  /** Category this package is aimed at. Empty = available across categories. */
  category: "photography" | "cinematography" | "branding" | "";
  /** When true, the package is presented as the recommended/default pick. */
  featured?: boolean;
}

export const PACKAGES: PackageDef[] = [
  {
    id: "photography-basic",
    tier: "basic",
    name: "Standalone Frames",
    price: "From ₦150,000",
    tagline: "A single session, a tight edit.",
    category: "photography",
    description:
      "One location, one concept, one curated edit delivered ready to publish. Good for portraits, product shots, or a focused editorial frame.",
    includes: [
      "1 location / 1 concept",
      "Up to 15 delivered edits",
      "Colour grading included",
      "Web-ready exports",
      "1 round of revisions",
    ],
  },
  {
    id: "photography-standard",
    tier: "standard",
    name: "Editorial Spread",
    price: "From ₦350,000",
    tagline: "A full story, told in frames.",
    category: "photography",
    featured: true,
    description:
      "A multi-frame editorial with direction, mood, and a considered edit across the shoot. Built for lookbooks, campaign stills, and featured project pages.",
    includes: [
      "Concept + mood direction",
      "2 locations / 2 setups",
      "Up to 40 delivered edits",
      "Full colour grade + retouching",
      "Web + print-ready exports",
      "2 rounds of revisions",
      "Feature on the project page",
    ],
  },
  {
    id: "photography-premium",
    tier: "premium",
    name: "Campaign Still Life",
    price: "From ₦750,000",
    tagline: "A stills campaign, end to end.",
    category: "photography",
    description:
      "A full stills campaign with pre-production, multiple setups, art direction support, and a delivery pipeline tuned for web, social, and print.",
    includes: [
      "Full pre-production + mood board",
      "3+ locations / setups",
      "Up to 80 delivered edits",
      "Advanced retouching + colour grade",
      "Web, social, and print exports",
      "3 rounds of revisions",
      "Featured project page + home placement",
      "Priority scheduling",
    ],
  },
  {
    id: "cinematography-basic",
    tier: "basic",
    name: "Single Cut",
    price: "From ₦250,000",
    tagline: "One film, one idea.",
    category: "cinematography",
    description:
      "A single short film or reel with a clear concept, clean capture, and a tight edit. Good for a product clip, event highlight, or brand tease.",
    includes: [
      "1 concept / 1 location",
      "Up to 60 seconds edited",
      "Colour grade included",
      "Sound mix (basic)",
      "Web-ready export",
      "1 round of revisions",
    ],
  },
  {
    id: "cinematography-standard",
    tier: "standard",
    name: "Film + Reel",
    price: "From ₦600,000",
    tagline: "A film and a cutdown, ready to publish.",
    category: "cinematography",
    featured: true,
    description:
      "A flagship short film plus a short reel cutdown from the same shoot — built for a project page, social, and a portfolio piece that holds together on its own.",
    includes: [
      "Concept + shot direction",
      "1–2 locations",
      "Up to 3 minutes (film) + 15s reel",
      "Full colour grade + sound design",
      "Web + social exports",
      "2 rounds of revisions",
      "Featured project page",
    ],
  },
  {
    id: "cinematography-premium",
    tier: "premium",
    name: "Campaign Film",
    price: "From ₦1,500,000",
    tagline: "A campaign film, end to end.",
    category: "cinematography",
    description:
      "A full campaign film with pre-production, art direction, multi-setup capture, sound design, and a delivery suite across web, social, and press.",
    includes: [
      "Full pre-production + storyboard",
      "2–3 locations / setups",
      "Up to 5 minutes (film) + cutdowns",
      "Advanced grade + full sound design",
      "Web, social, and press exports",
      "3 rounds of revisions",
      "Featured project page + home placement",
      "Priority scheduling + dedicated edit",
    ],
  },
  {
    id: "branding-basic",
    tier: "basic",
    name: "Identity Starter",
    price: "From ₦200,000",
    tagline: "A lean identity to get started.",
    category: "branding",
    description:
      "A focused identity package — logo, palette, type, and a short brand guide — enough to launch and look considered across web and social.",
    includes: [
      "Logo concept + refinement",
      "Colour palette",
      "Type recommendations",
      "Short brand guide (PDF)",
      "Web + social exports",
      "1 round of revisions",
    ],
  },
  {
    id: "branding-standard",
    tier: "standard",
    name: "Brand System",
    price: "From ₦500,000",
    tagline: "A system that scales with the work.",
    category: "branding",
    featured: true,
    description:
      "A fuller brand system with direction, applications, and a guide that actually gets used — for a launch, a rebrand, or a brand that needs to hold across touchpoints.",
    includes: [
      "Brand direction + mood",
      "Logo system + lockups",
      "Colour + type system",
      "Brand guide (expanded PDF)",
      "Key applications (web, social, print)",
      "2 rounds of revisions",
      "Feature on the project page",
    ],
  },
  {
    id: "branding-premium",
    tier: "premium",
    name: "Full Identity + Launch",
    price: "From ₦1,200,000",
    tagline: "A launch-ready brand, end to end.",
    category: "branding",
    description:
      "A comprehensive identity with strategy, art direction, applications across touchpoints, and a launch package — for a serious rebrand or a brand entering the market.",
    includes: [
      "Strategy + brand direction",
      "Full identity system",
      "Art direction for launch assets",
      "Applications across web, social, print",
      "Brand guide (full)",
      "3 rounds of revisions",
      "Featured project page + home placement",
      "Priority scheduling",
    ],
  },
];

/** Packages sorted for display: featured first, then by tier order. */
export function orderedPackages(
  category?: "photography" | "cinematography" | "branding" | ""
): PackageDef[] {
  // When category is undefined or empty, return all packages.
  if (!category) return PACKAGES;
  const filtered = PACKAGES.filter((p) => p.category === category);
  const tierOrder: Record<PackageTier, number> = {
    premium: 0,
    standard: 1,
    basic: 2,
  };
  return filtered.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return tierOrder[a.tier] - tierOrder[b.tier];
  });
}

/** Price range string for a category (used on the packages page header). */
export function priceRangeFor(category: PackageDef["category"]): string {
  // When category is empty, return the overall range.
  if (!category) {
    const allPrices = PACKAGES
      .map((p) => p.price.replace(/[^0-9]/g, ""))
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b));
    return `From ₦${allPrices[0] ?? "150,000"}`;
  }
  const items = PACKAGES.filter((p) => p.category === category);
  if (items.length === 0) return "From ₦150,000";
  if (items.length === 0) return "From ₦150,000";
  const lowest = items
    .map((p) => p.price.replace(/[^0-9]/g, ""))
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b))[0];
  return `From ₦${lowest ?? "150,000"}`;
}
