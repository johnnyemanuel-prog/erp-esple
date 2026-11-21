import type { Metadata, Viewport } from "next";
import { Moldura } from "@/componentes/Moldura";
import "./globals.css";

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
    <html lang="pt-BR">
      <body>
        <Moldura>{children}</Moldura>
      </body>
    </html>
  );
}
