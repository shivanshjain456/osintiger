// Technology Fingerprinting Engine — domain models and fingerprinter.
// Identifies, normalizes, and correlates technologies across 13 categories.
//
// Categories:
// 1. Frameworks (React, Vue, Next.js, Express, Django, Flask, Rails, etc.)
// 2. CMS (WordPress, Drupal, Joomla, Shopify, Magento, etc.)
// 3. Backend (Node.js, Python, Ruby, PHP, Java, .NET, Go, Rust + API styles)
// 4. Frontend (Bootstrap, Tailwind, Material UI, build systems)
// 5. Libraries (third-party JS/Python/Ruby/PHP libraries)
// 6. Analytics (Google Analytics, GTM, Adobe, Segment, Mixpanel, Matomo)
// 7. Payment Providers (Stripe, PayPal, Adyen, Braintree, Square, Klarna)
// 8. CDN (Cloudflare, Akamai, Fastly, CloudFront, Azure CDN)
// 9. Hosting (AWS, Azure, GCP, DigitalOcean, Heroku, Vercel, Netlify)
// 10. Reverse Proxies (Nginx, Apache, HAProxy, Envoy, Traefik, Caddy)
// 11. Cache (Redis, Memcached, Varnish, CDN edge cache)
// 12. Containers (Docker, Kubernetes, ECS, EKS, GKE, OpenShift)
// 13. Languages (JavaScript, TypeScript, Python, Ruby, PHP, Java, C#, Go, Rust)

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// Technology Category
// =====================

export type TechCategory =
  | "framework" | "cms" | "backend" | "frontend" | "library"
  | "analytics" | "payment" | "cdn" | "hosting" | "proxy"
  | "cache" | "container" | "language";

// =====================
// Technology Detection
// =====================

export interface TechnologyDetection {
  id: string;
  /** Technology name. */
  name: string;
  /** Category. */
  category: TechCategory;
  /** Subcategory (e.g., "frontend_framework", "backend_runtime", "payment_processor"). */
  subcategory: string;
  /** Version if detected. */
  version?: string;
  /** Confidence (0-1). */
  confidence: number;
  /** Source that provided evidence. */
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  /** Evidence text. */
  evidence: string;
  /** Whether this is a primary or secondary technology. */
  role: "primary" | "secondary";
  /** Detection method. */
  method: "header" | "body" | "dns" | "certificate" | "url" | "keyword" | "infrastructure";
}

// =====================
// Stack Profile
// =====================

export interface StackProfile {
  /** Primary technologies (core stack). */
  primary: TechnologyDetection[];
  /** Secondary technologies (supporting/auxiliary). */
  secondary: TechnologyDetection[];
  /** Stack summary description. */
  summary: string;
  /** Stack complexity (low/medium/high). */
  complexity: "low" | "medium" | "high";
  /** Technology count by category. */
  byCategory: Record<TechCategory, number>;
}

// =====================
// Complete Fingerprint Report
// =====================

export interface TechFingerprintReport {
  /** All technology detections. */
  detections: TechnologyDetection[];
  /** Correlated stack profile. */
  stack: StackProfile;
  /** Category summaries. */
  categories: { category: TechCategory; label: string; count: number; technologies: string[] }[];
  /** Assessment. */
  assessment: {
    totalTechnologies: number;
    primaryCount: number;
    secondaryCount: number;
    categoriesDetected: number;
    fingerprintConfidence: number;
    explanation: string;
  };
  /** Metadata. */
  meta: {
    sourcesAnalyzed: number;
    findingsAnalyzed: number;
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

export interface TechFingerprintApiResponse {
  investigation_id: string;
  report: TechFingerprintReport;
}

// =====================
// Category Labels
// =====================

export const TECH_CATEGORY_LABELS: Record<TechCategory, string> = {
  framework: "Frameworks",
  cms: "CMS",
  backend: "Backend",
  frontend: "Frontend",
  library: "Libraries",
  analytics: "Analytics",
  payment: "Payment Providers",
  cdn: "CDN",
  hosting: "Hosting",
  proxy: "Reverse Proxies",
  cache: "Cache",
  container: "Containers",
  language: "Languages",
};

// =====================
// Technology Patterns Database
// =====================

interface TechPattern {
  regex: RegExp;
  name: string;
  category: TechCategory;
  subcategory: string;
  versionGroup?: number;
  role: "primary" | "secondary";
  method: TechnologyDetection["method"];
}

// Comprehensive pattern database — 100+ technology fingerprints
const TECH_PATTERNS: TechPattern[] = [
  // === Frameworks (Frontend) ===
  { regex: /\breact\b/i, name: "React", category: "framework", subcategory: "frontend_framework", role: "primary", method: "keyword" },
  { regex: /\bvue\.?js\b/i, name: "Vue.js", category: "framework", subcategory: "frontend_framework", role: "primary", method: "keyword" },
  { regex: /\bangular\b/i, name: "Angular", category: "framework", subcategory: "frontend_framework", role: "primary", method: "keyword" },
  { regex: /\bsvelte\b/i, name: "Svelte", category: "framework", subcategory: "frontend_framework", role: "primary", method: "keyword" },
  { regex: /\bnext\.?js\b/i, name: "Next.js", category: "framework", subcategory: "frontend_framework", role: "primary", method: "keyword" },
  { regex: /\bnuxt\b/i, name: "Nuxt", category: "framework", subcategory: "frontend_framework", role: "primary", method: "keyword" },
  { regex: /\bremix\b/i, name: "Remix", category: "framework", subcategory: "frontend_framework", role: "primary", method: "keyword" },
  { regex: /\bember\.?js\b/i, name: "Ember.js", category: "framework", subcategory: "frontend_framework", role: "primary", method: "keyword" },
  { regex: /\bbackbone\.?js\b/i, name: "Backbone.js", category: "framework", subcategory: "frontend_framework", role: "secondary", method: "keyword" },

  // === Frameworks (Backend) ===
  { regex: /\bexpress\b/i, name: "Express", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\bfastify\b/i, name: "Fastify", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\bnest.?js\b/i, name: "NestJS", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\bdjango\b/i, name: "Django", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\bflask\b/i, name: "Flask", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\bfastapi\b/i, name: "FastAPI", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\bruby\s*on\s*rails|\brails\b/i, name: "Ruby on Rails", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\blaravel\b/i, name: "Laravel", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\bspring\s*boot|\bspring\b/i, name: "Spring Boot", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\basp\.?net\b/i, name: "ASP.NET", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\bphoenix\b/i, name: "Phoenix", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },
  { regex: /\bmediawiki\b/i, name: "MediaWiki", category: "framework", subcategory: "backend_framework", role: "primary", method: "keyword" },

  // === CMS ===
  { regex: /\bwordpress\b/i, name: "WordPress", category: "cms", subcategory: "cms_platform", role: "primary", method: "keyword" },
  { regex: /\bdrupal\b/i, name: "Drupal", category: "cms", subcategory: "cms_platform", role: "primary", method: "keyword" },
  { regex: /\bjoomla\b/i, name: "Joomla", category: "cms", subcategory: "cms_platform", role: "primary", method: "keyword" },
  { regex: /\bghost\b/i, name: "Ghost", category: "cms", subcategory: "cms_platform", role: "primary", method: "keyword" },
  { regex: /\bcontentful\b/i, name: "Contentful", category: "cms", subcategory: "headless_cms", role: "primary", method: "keyword" },
  { regex: /\bstrapi\b/i, name: "Strapi", category: "cms", subcategory: "headless_cms", role: "primary", method: "keyword" },
  { regex: /\bsanity\b/i, name: "Sanity", category: "cms", subcategory: "headless_cms", role: "primary", method: "keyword" },
  { regex: /\bwebflow\b/i, name: "Webflow", category: "cms", subcategory: "cms_platform", role: "primary", method: "keyword" },
  { regex: /\bshopify\b/i, name: "Shopify", category: "cms", subcategory: "ecommerce_platform", role: "primary", method: "keyword" },
  { regex: /\bmagento\b/i, name: "Magento", category: "cms", subcategory: "ecommerce_platform", role: "primary", method: "keyword" },
  { regex: /\/wp-admin\b/i, name: "WordPress", category: "cms", subcategory: "admin_interface", role: "primary", method: "url" },
  { regex: /\/wp-content\b/i, name: "WordPress", category: "cms", subcategory: "asset_path", role: "primary", method: "url" },
  { regex: /\/wp-includes\b/i, name: "WordPress", category: "cms", subcategory: "asset_path", role: "primary", method: "url" },

  // === Backend (Runtimes) ===
  { regex: /\bnode\.?js\b/i, name: "Node.js", category: "backend", subcategory: "runtime", role: "primary", method: "keyword" },
  { regex: /\bpython\b/i, name: "Python", category: "backend", subcategory: "runtime", role: "primary", method: "keyword" },
  { regex: /\bruby\b/i, name: "Ruby", category: "backend", subcategory: "runtime", role: "primary", method: "keyword" },
  { regex: /\bphp\b/i, name: "PHP", category: "backend", subcategory: "runtime", role: "primary", method: "keyword" },
  { regex: /\bjava\b/i, name: "Java", category: "backend", subcategory: "runtime", role: "primary", method: "keyword" },
  { regex: /\b\.?net\b/i, name: ".NET", category: "backend", subcategory: "runtime", role: "primary", method: "keyword" },
  { regex: /\bgo\b(?:lang)?/i, name: "Go", category: "backend", subcategory: "runtime", role: "primary", method: "keyword" },
  { regex: /\brust\b/i, name: "Rust", category: "backend", subcategory: "runtime", role: "primary", method: "keyword" },

  // === Backend (API Styles) ===
  { regex: /\/api\/v?\d/i, name: "REST API", category: "backend", subcategory: "api_style", role: "secondary", method: "url" },
  { regex: /\/graphql/i, name: "GraphQL", category: "backend", subcategory: "api_style", role: "primary", method: "url" },
  { regex: /\/grpc\b/i, name: "gRPC", category: "backend", subcategory: "api_style", role: "primary", method: "url" },

  // === Frontend (UI Libraries) ===
  { regex: /\bbootstrap\b/i, name: "Bootstrap", category: "frontend", subcategory: "ui_library", role: "secondary", method: "keyword" },
  { regex: /\btailwind\b/i, name: "Tailwind CSS", category: "frontend", subcategory: "ui_library", role: "secondary", method: "keyword" },
  { regex: /\bmaterial.?ui\b|\bmuib/i, name: "Material UI", category: "frontend", subcategory: "ui_library", role: "secondary", method: "keyword" },
  { regex: /\bant\s*design\b|\bantd\b/i, name: "Ant Design", category: "frontend", subcategory: "ui_library", role: "secondary", method: "keyword" },
  { regex: /\bchakra\s*ui\b/i, name: "Chakra UI", category: "frontend", subcategory: "ui_library", role: "secondary", method: "keyword" },
  { regex: /\bfoundation\b/i, name: "Foundation", category: "frontend", subcategory: "ui_library", role: "secondary", method: "keyword" },
  { regex: /\bbulma\b/i, name: "Bulma", category: "frontend", subcategory: "ui_library", role: "secondary", method: "keyword" },

  // === Libraries ===
  { regex: /\bjquery\b/i, name: "jQuery", category: "library", subcategory: "js_library", role: "secondary", method: "keyword" },
  { regex: /\blodash\b/i, name: "Lodash", category: "library", subcategory: "js_library", role: "secondary", method: "keyword" },
  { regex: /\bmoment\.?js\b/i, name: "Moment.js", category: "library", subcategory: "js_library", role: "secondary", method: "keyword" },
  { regex: /\baxios\b/i, name: "Axios", category: "library", subcategory: "js_library", role: "secondary", method: "keyword" },
  { regex: /\bthree\.?js\b/i, name: "Three.js", category: "library", subcategory: "js_library", role: "secondary", method: "keyword" },
  { regex: /\bd3\.?js\b/i, name: "D3.js", category: "library", subcategory: "js_library", role: "secondary", method: "keyword" },

  // === Analytics ===
  { regex: /\bgoogle\s*analytics\b|\bga4\b|\bua-\d+/i, name: "Google Analytics", category: "analytics", subcategory: "web_analytics", role: "primary", method: "keyword" },
  { regex: /\bgoogle\s*tag\s*manager\b|\bgtm\b/i, name: "Google Tag Manager", category: "analytics", subcategory: "tag_manager", role: "primary", method: "keyword" },
  { regex: /\badobe\s*analytics\b|\bs_code\b/i, name: "Adobe Analytics", category: "analytics", subcategory: "web_analytics", role: "primary", method: "keyword" },
  { regex: /\bsegment\b/i, name: "Segment", category: "analytics", subcategory: "cdp", role: "primary", method: "keyword" },
  { regex: /\bmixpanel\b/i, name: "Mixpanel", category: "analytics", subcategory: "product_analytics", role: "primary", method: "keyword" },
  { regex: /\bamplitude\b/i, name: "Amplitude", category: "analytics", subcategory: "product_analytics", role: "primary", method: "keyword" },
  { regex: /\bhotjar\b/i, name: "Hotjar", category: "analytics", subcategory: "session_replay", role: "secondary", method: "keyword" },
  { regex: /\bmatomo\b|\bpwiki\b/i, name: "Matomo", category: "analytics", subcategory: "web_analytics", role: "primary", method: "keyword" },
  { regex: /\bplausible\b/i, name: "Plausible", category: "analytics", subcategory: "web_analytics", role: "primary", method: "keyword" },

  // === Payment Providers ===
  { regex: /\bstripe\b/i, name: "Stripe", category: "payment", subcategory: "payment_processor", role: "primary", method: "keyword" },
  { regex: /\bpaypal\b/i, name: "PayPal", category: "payment", subcategory: "payment_processor", role: "primary", method: "keyword" },
  { regex: /\badyen\b/i, name: "Adyen", category: "payment", subcategory: "payment_processor", role: "primary", method: "keyword" },
  { regex: /\bbraintree\b/i, name: "Braintree", category: "payment", subcategory: "payment_processor", role: "primary", method: "keyword" },
  { regex: /\bsquare\b/i, name: "Square", category: "payment", subcategory: "payment_processor", role: "primary", method: "keyword" },
  { regex: /\bcheckout\.com\b/i, name: "Checkout.com", category: "payment", subcategory: "payment_processor", role: "primary", method: "keyword" },
  { regex: /\bklarna\b/i, name: "Klarna", category: "payment", subcategory: "buy_now_pay_later", role: "primary", method: "keyword" },
  { regex: /\bshopify\s*payments\b/i, name: "Shopify Payments", category: "payment", subcategory: "payment_processor", role: "primary", method: "keyword" },

  // === CDN ===
  { regex: /\bcloudflare\b/i, name: "Cloudflare", category: "cdn", subcategory: "cdn_platform", role: "primary", method: "header" },
  { regex: /\bakamai\b/i, name: "Akamai", category: "cdn", subcategory: "cdn_platform", role: "primary", method: "header" },
  { regex: /\bfastly\b/i, name: "Fastly", category: "cdn", subcategory: "cdn_platform", role: "primary", method: "header" },
  { regex: /\bcloudfront\b/i, name: "Amazon CloudFront", category: "cdn", subcategory: "cdn_platform", role: "primary", method: "infrastructure" },
  { regex: /\bazure\s*cdn\b/i, name: "Azure CDN", category: "cdn", subcategory: "cdn_platform", role: "primary", method: "infrastructure" },
  { regex: /\bgoogle\s*cloud\s*cdn\b/i, name: "Google Cloud CDN", category: "cdn", subcategory: "cdn_platform", role: "primary", method: "infrastructure" },
  { regex: /\bbunny\s*cdn\b/i, name: "Bunny CDN", category: "cdn", subcategory: "cdn_platform", role: "primary", method: "header" },

  // === Hosting ===
  { regex: /\bamazon\s*aws\b|\baws\b|\bec2\b|\bs3\b/i, name: "Amazon AWS", category: "hosting", subcategory: "cloud_hosting", role: "primary", method: "infrastructure" },
  { regex: /\bazure\b|\bmicrosoft\s*azure\b/i, name: "Microsoft Azure", category: "hosting", subcategory: "cloud_hosting", role: "primary", method: "infrastructure" },
  { regex: /\bgoogle\s*cloud\b|\bgcp\b/i, name: "Google Cloud", category: "hosting", subcategory: "cloud_hosting", role: "primary", method: "infrastructure" },
  { regex: /\bdigitalocean\b/i, name: "DigitalOcean", category: "hosting", subcategory: "cloud_hosting", role: "primary", method: "infrastructure" },
  { regex: /\bheroku\b/i, name: "Heroku", category: "hosting", subcategory: "paas_hosting", role: "primary", method: "infrastructure" },
  { regex: /\bvercel\b/i, name: "Vercel", category: "hosting", subcategory: "paas_hosting", role: "primary", method: "infrastructure" },
  { regex: /\bnetlify\b/i, name: "Netlify", category: "hosting", subcategory: "paas_hosting", role: "primary", method: "infrastructure" },
  { regex: /\brender\b/i, name: "Render", category: "hosting", subcategory: "paas_hosting", role: "primary", method: "infrastructure" },
  { regex: /\bfly\.io\b/i, name: "Fly.io", category: "hosting", subcategory: "paas_hosting", role: "primary", method: "infrastructure" },
  { regex: /\blinode\b/i, name: "Linode", category: "hosting", subcategory: "cloud_hosting", role: "primary", method: "infrastructure" },
  { regex: /\bwikimedia\b/i, name: "Wikimedia Foundation", category: "hosting", subcategory: "self_hosted", role: "primary", method: "infrastructure" },

  // === Reverse Proxies ===
  { regex: /Server:?\s*nginx/i, name: "Nginx", category: "proxy", subcategory: "reverse_proxy", versionGroup: 0, role: "primary", method: "header" },
  { regex: /\bnginx\b/i, name: "Nginx", category: "proxy", subcategory: "reverse_proxy", role: "primary", method: "header" },
  { regex: /Server:?\s*apache/i, name: "Apache", category: "proxy", subcategory: "reverse_proxy", role: "primary", method: "header" },
  { regex: /\bapache\b/i, name: "Apache", category: "proxy", subcategory: "reverse_proxy", role: "primary", method: "header" },
  { regex: /\bhaproxy\b/i, name: "HAProxy", category: "proxy", subcategory: "reverse_proxy", role: "primary", method: "header" },
  { regex: /\benvoy\b/i, name: "Envoy", category: "proxy", subcategory: "reverse_proxy", role: "primary", method: "header" },
  { regex: /\btraefik\b/i, name: "Traefik", category: "proxy", subcategory: "reverse_proxy", role: "primary", method: "header" },
  { regex: /\bcaddy\b/i, name: "Caddy", category: "proxy", subcategory: "reverse_proxy", role: "primary", method: "header" },
  { regex: /\bIIS\b/i, name: "Microsoft IIS", category: "proxy", subcategory: "reverse_proxy", role: "primary", method: "header" },

  // === Cache ===
  { regex: /\bredis\b/i, name: "Redis", category: "cache", subcategory: "in_memory_cache", role: "primary", method: "keyword" },
  { regex: /\bmemcached\b/i, name: "Memcached", category: "cache", subcategory: "in_memory_cache", role: "primary", method: "keyword" },
  { regex: /\bvarnish\b/i, name: "Varnish Cache", category: "cache", subcategory: "http_cache", role: "primary", method: "header" },
  { regex: /\bx-cache\b/i, name: "CDN Edge Cache", category: "cache", subcategory: "edge_cache", role: "secondary", method: "header" },
  { regex: /\bcache-control\b/i, name: "HTTP Caching", category: "cache", subcategory: "browser_cache", role: "secondary", method: "header" },
  { regex: /\betag\b/i, name: "ETag Caching", category: "cache", subcategory: "validation_cache", role: "secondary", method: "header" },
  { regex: /\bstale-while-revalidate\b/i, name: "Stale-While-Revalidate", category: "cache", subcategory: "cache_strategy", role: "secondary", method: "header" },

  // === Containers ===
  { regex: /\bdocker\b/i, name: "Docker", category: "container", subcategory: "container_runtime", role: "primary", method: "keyword" },
  { regex: /\bkubernetes\b|\bk8s\b/i, name: "Kubernetes", category: "container", subcategory: "orchestration", role: "primary", method: "keyword" },
  { regex: /\bcontainerd\b/i, name: "containerd", category: "container", subcategory: "container_runtime", role: "primary", method: "keyword" },
  { regex: /\bpodman\b/i, name: "Podman", category: "container", subcategory: "container_runtime", role: "primary", method: "keyword" },
  { regex: /\bopenshift\b/i, name: "OpenShift", category: "container", subcategory: "orchestration", role: "primary", method: "keyword" },
  { regex: /\bamazon\s*ecs\b/i, name: "Amazon ECS", category: "container", subcategory: "orchestration", role: "primary", method: "infrastructure" },
  { regex: /\bamazon\s*eks\b/i, name: "Amazon EKS", category: "container", subcategory: "orchestration", role: "primary", method: "infrastructure" },
  { regex: /\bgke\b/i, name: "Google GKE", category: "container", subcategory: "orchestration", role: "primary", method: "infrastructure" },

  // === Languages ===
  { regex: /\bjavascript\b/i, name: "JavaScript", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\btypescript\b/i, name: "TypeScript", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\bpython\b/i, name: "Python", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\bruby\b/i, name: "Ruby", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\bphp\b/i, name: "PHP", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\bjava\b/i, name: "Java", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\bc\s*#\b|\bcsharp\b/i, name: "C#", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\bgo\b(?:lang)?/i, name: "Go", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\brust\b/i, name: "Rust", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\bkotlin\b/i, name: "Kotlin", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\bswift\b/i, name: "Swift", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
  { regex: /\bscala\b/i, name: "Scala", category: "language", subcategory: "programming_language", role: "primary", method: "keyword" },
];

// =====================
// Fingerprinter
// =====================

export function fingerprintTechnologies(sourceResults: SourceResult[]): TechFingerprintReport {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[] = [];

  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({ finding: f, source: sr.source, sourceLabel: sr.source_label, tier });
    }
  }

  const detections: TechnologyDetection[] = [];
  const seen = new Set<string>(); // dedup by name+category

  for (const { finding, source, sourceLabel, tier } of allFindings) {
    const text = finding.data;
    for (const pattern of TECH_PATTERNS) {
      const m = text.match(pattern.regex);
      if (m) {
        const key = `${pattern.name}|${pattern.category}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Try to extract version
        let version: string | undefined;
        if (pattern.versionGroup && m[pattern.versionGroup]) {
          const versionMatch = m[pattern.versionGroup].match(/[\d.]+/);
          version = versionMatch ? versionMatch[0] : undefined;
        }
        // Also try common version patterns near the technology name
        if (!version) {
          const versionNearby = text.match(new RegExp(`${pattern.name}[/\\s]+([\\d.]+)`, "i"));
          if (versionNearby) version = versionNearby[1];
        }

        // Determine method based on source
        let method = pattern.method;
        if (source === "httpheaders") method = "header";
        else if (source === "crtsh") method = "certificate";
        else if (source === "doh" || source === "dns_google" || source === "openrdap") method = "dns";

        detections.push({
          id: `tech_${detections.length}`,
          name: pattern.name,
          category: pattern.category,
          subcategory: pattern.subcategory,
          version,
          confidence: finding.confidence,
          source, sourceLabel, tier,
          evidence: text.slice(0, 150),
          role: pattern.role,
          method,
        });
      }
    }
  }

  // Build stack profile
  const primary = detections.filter((d) => d.role === "primary");
  const secondary = detections.filter((d) => d.role === "secondary");
  const byCategory = {} as Record<TechCategory, number>;
  for (const d of detections) {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
  }
  const categoriesDetected = Object.keys(byCategory).length;
  const complexity: "low" | "medium" | "high" =
    detections.length > 15 ? "high" : detections.length > 5 ? "medium" : "low";

  const primaryNames = [...new Set(primary.map((d) => d.name))];
  const secondaryNames = [...new Set(secondary.map((d) => d.name))];
  const summary = `${detections.length} technologies detected across ${categoriesDetected} categories. ` +
    `Primary stack: ${primaryNames.slice(0, 5).join(", ")}${primaryNames.length > 5 ? "..." : ""}. ` +
    `Secondary: ${secondaryNames.length} supporting technologies. ` +
    `Stack complexity: ${complexity}.`;

  const stack: StackProfile = { primary, secondary, summary, complexity, byCategory };

  // Build category summaries
  const categoryKeys = Object.keys(TECH_CATEGORY_LABELS) as TechCategory[];
  const categories = categoryKeys
    .filter((cat) => byCategory[cat] && byCategory[cat] > 0)
    .map((cat) => ({
      category: cat,
      label: TECH_CATEGORY_LABELS[cat],
      count: byCategory[cat],
      technologies: detections.filter((d) => d.category === cat).map((d) => d.version ? `${d.name} ${d.version}` : d.name),
    }));

  // Assessment
  const fingerprintConfidence = detections.length > 0
    ? Math.round((detections.reduce((s, d) => s + d.confidence, 0) / detections.length) * 100)
    : 0;

  const explanation = buildAssessmentExplanation(
    detections.length, primary.length, secondary.length,
    categoriesDetected, fingerprintConfidence, complexity, categories
  );

  return {
    detections: detections.sort((a, b) => {
      // Sort by category order, then primary first, then name
      const catOrder = categoryKeys.indexOf(a.category) - categoryKeys.indexOf(b.category);
      if (catOrder !== 0) return catOrder;
      if (a.role !== b.role) return a.role === "primary" ? -1 : 1;
      return a.name.localeCompare(b.name);
    }),
    stack,
    categories,
    assessment: {
      totalTechnologies: detections.length,
      primaryCount: primary.length,
      secondaryCount: secondary.length,
      categoriesDetected,
      fingerprintConfidence,
      explanation,
    },
    meta: {
      sourcesAnalyzed: successfulResults.length,
      findingsAnalyzed: allFindings.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// =====================
// Helpers
// =====================

function buildAssessmentExplanation(
  total: number, primary: number, secondary: number,
  categories: number, confidence: number, complexity: string,
  catSummaries: { category: TechCategory; label: string; count: number; technologies: string[] }[]
): string {
  if (total === 0) {
    return "No technologies fingerprinted from available evidence. The target may not expose technology indicators in collected data.";
  }

  const parts: string[] = [];
  parts.push(`${total} technologies fingerprinted (${primary} primary, ${secondary} secondary)`);
  parts.push(`across ${categories} categories`);
  parts.push(`with ${confidence}% average confidence`);
  parts.push(`Stack complexity: ${complexity.toUpperCase()}`);

  const catSummary = catSummaries.map((c) => `${c.label}: ${c.count}`).join(", ");
  if (catSummary) parts.push(`Categories: ${catSummary}`);

  if (complexity === "high") {
    parts.push("Complex technology stack — multiple layers of infrastructure, frameworks, and services detected");
  } else if (complexity === "medium") {
    parts.push("Moderate technology stack — standard web application architecture");
  } else {
    parts.push("Simple technology stack — minimal technology indicators detected");
  }

  return parts.join(". ") + ".";
}
