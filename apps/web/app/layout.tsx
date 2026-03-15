import type { Metadata } from "next"
import { Anton, Space_Mono } from "next/font/google"

import "@/styles/app.css"

const fontDisplay = Anton({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
})

const fontBody = Space_Mono({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "700"],
})

const siteUrl = "https://decbench.ai"
const title = "DEC Bench — Open-Source Data Engineering Benchmark for AI Agents"
const description =
  "Evaluate AI coding agents on real data engineering tasks. Five-gate scoring against live Postgres, Redpanda, and ClickHouse. Compare Claude Code, Codex, and Cursor side by side."

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(siteUrl),
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "DEC Bench",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  keywords: [
    "AI agent benchmark",
    "data engineering evaluation",
    "coding agent eval",
    "ClickHouse benchmark",
    "Postgres benchmark",
    "AI agent comparison",
    "Claude Code eval",
    "Codex eval",
    "Cursor eval",
    "open source benchmark",
    "SWE-bench alternative",
    "data engineering competency",
  ],
  alternates: {
    canonical: siteUrl,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${fontDisplay.variable} ${fontBody.variable} antialiased`}
        style={{ backgroundColor: "#ffffff" }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "DEC Bench",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "macOS, Linux",
              description,
              url: siteUrl,
              author: {
                "@type": "Organization",
                name: "FiveOneFour",
                url: "https://fiveonefour.com",
              },
              license: "https://github.com/514-labs/agent-evals/blob/main/LICENSE",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
        {children}
      </body>
    </html>
  )
}
