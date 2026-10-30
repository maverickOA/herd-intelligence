import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Herd Intelligence",
    short_name: "Herd",
    description: "Livestock records, pedigrees and breeding checks for your farm.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f0",
    theme_color: "#2f6b45",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
