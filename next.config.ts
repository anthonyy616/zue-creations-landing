import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Anchor tracing to this repo so stray lockfiles elsewhere (e.g. the user
  // home directory) never get inferred as the workspace root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
