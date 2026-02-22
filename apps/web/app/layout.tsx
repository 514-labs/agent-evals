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

export const metadata: Metadata = {
  title: "DEC Bench — Agent Evals for ClickHouse",
  description:
    "The open-source benchmark for evaluating AI agent data engineering competency on real-world data engineering tasks and workloads.",
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
        {children}
      </body>
    </html>
  )
}
