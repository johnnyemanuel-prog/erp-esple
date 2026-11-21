import type { Metadata, Viewport } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import { Moldura } from "@/componentes/Moldura";
import "./globals.css";

// Fontes do logo: Playfair Display (ESPLÊNDIDA) e Montserrat (SEMIJOIAS). Servidas pelo próprio app.
const titulo = Playfair_Display({ subsets: ["latin"], weight: ["600"], variable: "--fonte-titulo", display: "swap" });
const texto = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--fonte-texto", display: "swap" });

export const metadata: Metadata = {
  title: "Esplêndida",
  description: "Cadastro, preço e venda de semijoias",
  applicationName: "Esplêndida",
  appleWebApp: { capable: true, title: "Esplêndida", statusBarStyle: "default" },
  icons: { icon: "/icone-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#6a2e61",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable}`}>
      <body>
        <Moldura>{children}</Moldura>
      </body>
    </html>
  );
}
