import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page shows tenant data behind Row Level Security, read with the
  // signed-in user's session. We deliberately keep Cache Components off so no
  // tenant data is ever cached on the server across requests or users.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
