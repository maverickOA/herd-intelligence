import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Herd Intelligence",
    short_name: "Herd",
    description: "Livestock records, pedigrees and breeding checks for your farm.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfcfc",
    theme_color: "#1e4731",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
