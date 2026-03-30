import type { Metadata } from "next"
import { Lora, Chivo_Mono } from "next/font/google"

import "@/styles/app.css"

const fontSerif = Lora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
})

const fontMono = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "700"],
})

const siteUrl = "https://decbench.ai"
const title = "DEC Bench — A Multi-Gate Evaluation Framework for AI Coding Agents"
const description =
  "An open benchmark extending evaluation beyond functional correctness into robustness, performance, and production readiness across five sequential quality gates. 37 scenarios, 3 agents, 3 harnesses."

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
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
    "AI agent evaluation",
    "data engineering benchmark",
    "coding agent benchmark",
    "multi-gate evaluation",
    "sequential quality gates",
    "DEC Bench",
    "open benchmark",
    "reproducible evaluation",
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
        className={`${fontSerif.variable} ${fontMono.variable} antialiased`}
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
                name: "514 Labs",
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
