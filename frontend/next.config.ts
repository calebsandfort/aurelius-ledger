import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/docs/:path*",
        destination: "/docs/:path*",
      },
      {
        source: "/help/:path*",
        destination: "/help/:path*",
      },
    ]
  },
}

export default nextConfig
