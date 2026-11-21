import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Esplêndida",
    short_name: "Esplêndida",
    description: "Cadastro, preço e venda de semijoias",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#6a2e61",
    theme_color: "#6a2e61",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-mascara-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
