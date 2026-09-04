import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Anchor tracing to this repo so stray lockfiles elsewhere (e.g. the user
  // home directory) never get inferred as the workspace root.
  outputFileTracingRoot: path.join(__dirname),
  // Media never goes through the Next optimizer: every <Image> resolves to a
  // pre-generated R2 variant via the custom loader in lib/image-loader.ts.
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
  },
};

export default nextConfig;
