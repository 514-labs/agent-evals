import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  serverExternalPackages: ["typescript", "twoslash"],
  async redirects() {
    return [
      {
        source: "/docs/registry",
        destination: "/docs/registry/scenarios",
        permanent: false,
      },
    ]
  },
}

export default withMDX(nextConfig)
