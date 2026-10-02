import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_URL || "https://osintiger.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OSINTiger // Anonymous Intelligence Platform",
    template: "%s · OSINTiger",
  },
  description:
    "OSINTiger: multi-source OSINT investigation platform with AI synthesis, strict source attribution, ACH analysis, crypto tracing, sanctions screening and geospatial intel.",
  keywords: [
    "OSINT",
    "OSINTiger",
    "intelligence",
    "investigation",
    "sanctions",
    "OSINT tools",
    "AI analysis",
    "threat intelligence",
    "due diligence",
    "cybersecurity",
  ],
  authors: [{ name: "OSINTiger" }],
  creator: "OSINTiger",
  publisher: "OSINTiger",
  applicationName: "OSINTiger",
  generator: "Next.js",
  referrer: "strict-origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
    shortcut: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
    apple: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "OSINTiger // Anonymous Intelligence Platform",
    description: "Multi-source OSINT investigation with AI synthesis, strict source attribution, ACH analysis, and geospatial intelligence.",
    siteName: "OSINTiger",
    type: "website",
    locale: "en_US",
    url: siteUrl,
    images: [
      {
        url: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
        width: 1200,
        height: 630,
        alt: "OSINTiger — Anonymous Intelligence Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OSINTiger // Anonymous Intelligence Platform",
    description: "Multi-source OSINT investigation with AI synthesis and strict source attribution.",
    images: ["https://z-cdn.chatglm.cn/z-ai/static/logo.svg"],
    creator: "@osintiger",
    site: "@osintiger",
  },
  verification: {
    google: "",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

// Structured data for the application (JSON-LD)
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "OSINTiger",
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  description:
    "Multi-source OSINT investigation platform with AI synthesis, strict source attribution, ACH analysis, crypto tracing, sanctions screening and geospatial intelligence.",
  url: siteUrl,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier with 3 investigations/month. Paid plans from $49/month.",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "127",
  },
  featureList: [
    "74+ OSINT source APIs",
    "AI-powered report synthesis",
    "Analysis of Competing Hypotheses (ACH)",
    "Autonomous investigation agent",
    "Recursive entity discovery",
    "Live monitoring with change detection",
    "Crypto wallet tracing",
    "OFAC/Interpol sanctions screening",
    "Visual intelligence (VLM)",
    "Knowledge base with entity resolution",
    "Provenance chain with full audit trail",
    "Multi-agent debate analysis",
  ],
  publisher: {
    "@type": "Organization",
    name: "OSINTiger",
    url: siteUrl,
    logo: {
      "@type": "ImageObject",
      url: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
    },
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "OSINTiger",
  url: siteUrl,
  description:
    "Anonymous OSINT investigation platform with multi-source aggregation, AI synthesis, and strict source attribution.",
  publisher: {
    "@type": "Organization",
    name: "OSINTiger",
    url: siteUrl,
  },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/#/?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('osintiger-theme')||'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body
        className={`${jetbrainsMono.variable} ${inter.variable} antialiased bg-background text-foreground`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-[var(--hack-green)] focus:text-[var(--hack-bg)] focus:px-3 focus:py-1.5 focus:font-mono focus:text-xs focus:uppercase"
        >
          Skip to content
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
