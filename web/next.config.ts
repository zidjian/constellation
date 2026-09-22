import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PM2 ejecuta .next/standalone/server.js (ADR-0003). Ver web/CLAUDE.md para los estáticos.
  output: "standalone",
};

export default nextConfig;
