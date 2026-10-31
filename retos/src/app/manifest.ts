import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Boca Abajo",
    short_name: "Boca Abajo",
    description: "Retos entre amigos: votan sin saber quién está detrás de cada carta.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17100D",
    theme_color: "#17100D",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
