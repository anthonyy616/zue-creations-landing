import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Anchor tracing to this repo so stray lockfiles elsewhere (e.g. the user
  // home directory) never get inferred as the workspace root.
  outputFileTracingRoot: path.join(__dirname),

  // sharp's native binaries must not be bundled into the serverless function.
  // Without this, Vercel may bloat cold starts or silently pick the wrong binary.
  serverExternalPackages: ["sharp"],

  // Reduce dev compile time by tree-shaking barrel imports from large UI libs.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // Media never goes through the Next optimizer: every <Image> resolves to a
  // pre-generated R2 variant via the custom loader in lib/image-loader.ts.
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    // Allow images from our R2 custom domain.
    remotePatterns: process.env.R2_PUBLIC_MEDIA_URL
      ? [
          {
            protocol: "https",
            hostname: process.env.R2_PUBLIC_MEDIA_URL
              .replace(/^https?:\/\//, "")
              .replace(/\/.*$/, ""),
          },
        ]
      : [],
  },
};

export default nextConfig;