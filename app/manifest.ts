import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Draftly",
    short_name: "Draftly",
    description: "HTML-Entwürfe prüfen und kommentieren.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d3c8e",
    theme_color: "#0d3c8e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
