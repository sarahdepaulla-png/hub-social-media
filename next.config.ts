import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // O `npx convex deploy` da Vercel injeta a URL; garante o nome que o app lê.
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "",
  },
};

export default nextConfig;
