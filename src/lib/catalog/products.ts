import type { ProductListing, RegionCode } from "@/lib/core/listing";
import type { SearchQuery } from "@/lib/core/provider";
import { getAppBaseUrl } from "@/lib/config/app";

/**
 * The built-in digital merchant. Every product here is fulfilled instantly
 * after a verified PayPal capture (license key / download / AI service), so
 * the demo is a real end-to-end purchase instead of a redirect to a retailer
 * that may not accept PayPal.
 *
 * Prices are in USD because the PayPal sandbox integration is granted USD.
 */
export type DeliverableType = "license" | "download" | "service";

export type CatalogProduct = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  brand: string;
  priceMinor: number;
  originalPriceMinor?: number;
  emoji: string;
  gradient: string;
  tags: string[];
  highlights: string[];
  deliverable: { type: DeliverableType; label: string; fileName?: string };
  rating: { value: number; count: number };
};

export const CATALOG: CatalogProduct[] = [
  {
    id: "agent-starter-kit",
    title: "Agent Builder Starter Kit",
    tagline: "Everything you need to ship your first production AI agent.",
    description:
      "A battle-tested repository with tool-calling loops, retries, evals, and a deployment checklist. Includes 12 runnable examples and a typed tool schema.",
    category: "Templates",
    brand: "PayPilot Studio",
    priceMinor: 1900,
    originalPriceMinor: 2900,
    emoji: "🤖",
    gradient: "from-accent/30 via-accent-2/20 to-accent-3/20",
    tags: ["agent", "ai", "template", "code", "developer", "starter"],
    highlights: ["12 runnable agent examples", "Typed tool-calling schemas", "Eval harness + CI recipe"],
    deliverable: { type: "download", label: "Starter kit (ZIP)", fileName: "agent-starter-kit.zip" },
    rating: { value: 4.9, count: 412 },
  },
  {
    id: "prompt-pack-pro",
    title: "Prompt Pack Pro — 200 Prompts",
    tagline: "Production prompts for product, marketing, and engineering.",
    description:
      "200 structured prompts with variables, guardrails, and expected outputs. Organised by job-to-be-done so your team can copy, adapt, and ship.",
    category: "Prompt Packs",
    brand: "PayPilot Studio",
    priceMinor: 1200,
    emoji: "✨",
    gradient: "from-accent-2/30 via-accent/20 to-accent-3/20",
    tags: ["prompt", "prompts", "chatgpt", "marketing", "writing", "ai"],
    highlights: ["200 reusable prompts", "Variables + guardrails", "Copy-paste ready"],
    deliverable: { type: "download", label: "Prompt library (PDF + JSON)", fileName: "prompt-pack-pro.zip" },
    rating: { value: 4.8, count: 1290 },
  },
  {
    id: "saas-ui-kit",
    title: "SaaS UI Kit — Figma + Tailwind",
    tagline: "A dark, modern component system for AI products.",
    description:
      "40+ responsive components, 8 page templates, and matching Tailwind tokens. Built for dashboards, settings, billing, and onboarding flows.",
    category: "Templates",
    brand: "PayPilot Studio",
    priceMinor: 2900,
    emoji: "🎛️",
    gradient: "from-accent/30 via-accent-3/20 to-accent-2/20",
    tags: ["ui", "figma", "tailwind", "design", "dashboard", "saas"],
    highlights: ["40+ components", "Figma + Tailwind parity", "Dark mode first"],
    deliverable: { type: "download", label: "Figma + code bundle", fileName: "saas-ui-kit.zip" },
    rating: { value: 4.9, count: 236 },
  },
  {
    id: "ai-product-cookbook",
    title: "The AI Product Cookbook",
    tagline: "How to turn an AI demo into a product people pay for.",
    description:
      "A practical 120-page playbook covering discovery, trust, pricing, evals, and go-to-market for AI features. Written for builders, not researchers.",
    category: "Learning",
    brand: "PayPilot Studio",
    priceMinor: 1500,
    emoji: "📘",
    gradient: "from-accent-3/25 via-accent/20 to-accent-2/20",
    tags: ["book", "product", "ai", "learning", "startup", "guide"],
    highlights: ["120-page playbook", "Pricing + eval templates", "Real case studies"],
    deliverable: { type: "download", label: "Cookbook (PDF + EPUB)", fileName: "ai-product-cookbook.zip" },
    rating: { value: 4.7, count: 684 },
  },
  {
    id: "pitch-deck-template",
    title: "Hackathon Pitch Deck Template",
    tagline: "The 8-slide deck that gets judges to lean in.",
    description:
      "A judged-hackathon deck: problem, insight, demo, architecture, proof, impact, ask. Includes a filled example and speaker notes.",
    category: "Templates",
    brand: "PayPilot Studio",
    priceMinor: 900,
    emoji: "📊",
    gradient: "from-accent/25 via-accent-2/20 to-accent-3/20",
    tags: ["pitch", "deck", "hackathon", "startup", "presentation", "template"],
    highlights: ["8-slide structure", "Filled example deck", "Speaker notes + timing"],
    deliverable: { type: "download", label: "Deck template (PPTX + Figma)", fileName: "pitch-deck-template.zip" },
    rating: { value: 4.8, count: 918 },
  },
  {
    id: "ai-api-credits",
    title: "10,000 AI API Credits",
    tagline: "Top up your prototype without touching a credit card form.",
    description:
      "A prefunded credit pack for the PayPilot demo inference gateway. Redeem with your license key for 10,000 metered requests.",
    category: "Credits",
    brand: "PayPilot Studio",
    priceMinor: 2500,
    emoji: "⚡",
    gradient: "from-warn/25 via-accent/20 to-accent-3/20",
    tags: ["credits", "api", "ai", "tokens", "usage", "developer"],
    highlights: ["10,000 metered requests", "Instant license key", "No subscription"],
    deliverable: { type: "license", label: "API credit license key" },
    rating: { value: 4.6, count: 158 },
  },
  {
    id: "logo-studio",
    title: "Logo Studio — 20 Concepts",
    tagline: "A senior designer's logo sprint, delivered by AI + review.",
    description:
      "Submit your brand brief and receive 20 distinct logo concepts plus a usage sheet. Human-reviewed before delivery.",
    category: "AI Services",
    brand: "PayPilot Studio",
    priceMinor: 3500,
    emoji: "🎨",
    gradient: "from-accent-2/30 via-accent-2/15 to-accent/20",
    tags: ["logo", "design", "brand", "service", "creative", "ai"],
    highlights: ["20 distinct concepts", "Human review included", "Commercial usage sheet"],
    deliverable: { type: "service", label: "Logo sprint brief + delivery" },
    rating: { value: 4.9, count: 87 },
  },
  {
    id: "founder-os",
    title: "Founder OS — Notion Workspace",
    tagline: "Run your startup from one calm dashboard.",
    description:
      "A Notion workspace with goals, CRM, fundraising, hiring, and a weekly review ritual. Duplicate once and it adapts to your stage.",
    category: "Templates",
    brand: "PayPilot Studio",
    priceMinor: 1400,
    emoji: "🧭",
    gradient: "from-accent/25 via-accent-3/20 to-accent-2/20",
    tags: ["notion", "founder", "startup", "template", "productivity", "crm"],
    highlights: ["Notion-native", "Weekly review ritual", "Fundraising + hiring trackers"],
    deliverable: { type: "download", label: "Notion duplicate link + guide", fileName: "founder-os.txt" },
    rating: { value: 4.7, count: 341 },
  },
  {
    id: "agent-security-checklist",
    title: "AI Agent Security Checklist",
    tagline: "Ship agents that cannot be talked into spending your money.",
    description:
      "A 60-point checklist covering prompt injection, tool allowlists, spend caps, human approval, audit logs, and incident response.",
    category: "Learning",
    brand: "PayPilot Studio",
    priceMinor: 1100,
    emoji: "🛡️",
    gradient: "from-success/20 via-accent/20 to-accent-2/20",
    tags: ["security", "agent", "checklist", "safety", "ai", "compliance"],
    highlights: ["60 actionable checks", "Threat model template", "Incident response runbook"],
    deliverable: { type: "download", label: "Checklist (PDF + Notion)", fileName: "agent-security-checklist.zip" },
    rating: { value: 4.9, count: 203 },
  },
  {
    id: "landing-sprint",
    title: "Landing Page Sprint",
    tagline: "A conversion-ready landing page in 48 hours.",
    description:
      "AI drafts the copy and layout; a human edits it for your voice. Delivered as a responsive HTML/Tailwind page plus a copy doc.",
    category: "AI Services",
    brand: "PayPilot Studio",
    priceMinor: 4900,
    emoji: "🚀",
    gradient: "from-accent/30 via-accent-2/25 to-accent-3/20",
    tags: ["landing", "page", "copy", "service", "website", "conversion"],
    highlights: ["48-hour turnaround", "Responsive Tailwind page", "Copy doc included"],
    deliverable: { type: "service", label: "Landing page sprint brief" },
    rating: { value: 4.8, count: 64 },
  },
  {
    id: "resume-review",
    title: "AI Resume Review + Rewrite",
    tagline: "A sharper resume, reviewed against the job you want.",
    description:
      "Upload your resume and target role. You get a line-by-line rewrite, an ATS keyword map, and a 7-day improvement plan.",
    category: "AI Services",
    brand: "PayPilot Studio",
    priceMinor: 1800,
    emoji: "📄",
    gradient: "from-accent-3/25 via-accent/20 to-accent-2/20",
    tags: ["resume", "career", "review", "service", "job", "ats"],
    highlights: ["Line-by-line rewrite", "ATS keyword map", "7-day plan"],
    deliverable: { type: "service", label: "Resume review brief" },
    rating: { value: 4.8, count: 512 },
  },
  {
    id: "demo-video-script",
    title: "Demo Video Script Pack",
    tagline: "A 3-minute demo that judges actually watch.",
    description:
      "Shot-by-shot scripts and storyboards for hackathon demos: hook, problem, live proof, architecture, and a memorable close.",
    category: "Templates",
    brand: "PayPilot Studio",
    priceMinor: 1300,
    emoji: "🎬",
    gradient: "from-accent-2/25 via-accent/20 to-accent-3/25",
    tags: ["demo", "video", "script", "hackathon", "presentation", "story"],
    highlights: ["3 validated scripts", "Shot-by-shot storyboards", "Timing + narration guide"],
    deliverable: { type: "download", label: "Script pack (PDF + DOCX)", fileName: "demo-video-script-pack.zip" },
    rating: { value: 4.9, count: 176 },
  },
];

export const CATALOG_CURRENCY = "USD" as const;

export function getCatalogProduct(id: string): CatalogProduct | undefined {
  return CATALOG.find((p) => p.id === id);
}

export function catalogProductToListing(product: CatalogProduct, region: RegionCode = "US"): ProductListing {
  const base = getAppBaseUrl();
  return {
    id: `paypilot:${product.id}`,
    provider: "paypilot",
    externalId: product.id,
    title: product.title,
    canonicalUrl: `${base}/store/${product.id}`,
    price: { amountMinor: product.priceMinor, currency: CATALOG_CURRENCY },
    originalPrice: product.originalPriceMinor
      ? { amountMinor: product.originalPriceMinor, currency: CATALOG_CURRENCY }
      : undefined,
    availability: "IN_STOCK",
    seller: "PayPilot Studio",
    brand: product.brand,
    category: product.category,
    rating: product.rating,
    attributes: {
      emoji: product.emoji,
      tagline: product.tagline,
      tags: product.tags.join(","),
      deliverableType: product.deliverable.type,
      deliverable: product.deliverable.label,
    },
    region,
    fetchedAt: new Date().toISOString(),
    attribution: "Sold and fulfilled by PayPilot Studio. Digital delivery is instant after PayPal capture.",
  };
}

function haystack(product: CatalogProduct): string {
  return [product.title, product.tagline, product.description, product.category, product.brand, ...product.tags]
    .join(" ")
    .toLowerCase();
}

/** Store search: weighted keyword match with a sensible best-seller fallback. */
export function searchCatalog(query: SearchQuery): ProductListing[] {
  const tokens = query.q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  let scored = CATALOG.map((product) => {
    const hay = haystack(product);
    let score = 0;
    for (const token of tokens) {
      if (product.title.toLowerCase().includes(token)) score += 4;
      else if (product.category.toLowerCase().includes(token)) score += 3;
      else if (product.tags.some((t) => t.includes(token))) score += 2;
      else if (hay.includes(token)) score += 1;
    }
    return { product, score };
  });

  if (tokens.length > 0 && scored.some((s) => s.score > 0)) {
    scored = scored.filter((s) => s.score > 0);
  }

  let products = scored
    .sort((a, b) => b.score - a.score || b.product.rating.value - a.product.rating.value)
    .map((s) => s.product);

  if (query.minPriceMinor !== undefined) {
    products = products.filter((p) => p.priceMinor >= query.minPriceMinor!);
  }
  if (query.maxPriceMinor !== undefined) {
    products = products.filter((p) => p.priceMinor <= query.maxPriceMinor!);
  }
  if (query.categories.length > 0) {
    products = products.filter((p) => query.categories.includes(p.category));
  }

  switch (query.sort) {
    case "price_asc":
      products = [...products].sort((a, b) => a.priceMinor - b.priceMinor);
      break;
    case "price_desc":
      products = [...products].sort((a, b) => b.priceMinor - a.priceMinor);
      break;
    case "rating":
      products = [...products].sort((a, b) => b.rating.value - a.rating.value);
      break;
    default:
      break;
  }

  const offset = query.offset;
  return products.slice(offset, offset + query.limit).map((p) => catalogProductToListing(p, query.region));
}

/** Compact projection handed to the language model. No hallucinated fields. */
export type PlannerProduct = {
  id: string;
  title: string;
  priceMinor: number;
  currency: string;
  category: string;
  tags: string[];
  description: string;
  highlights: string[];
  rating: { value: number; count: number };
};

export function catalogForPlanner(): PlannerProduct[] {
  return CATALOG.map((p) => ({
    id: p.id,
    title: p.title,
    priceMinor: p.priceMinor,
    currency: CATALOG_CURRENCY,
    category: p.category,
    tags: p.tags,
    description: p.description,
    highlights: p.highlights,
    rating: p.rating,
  }));
}
