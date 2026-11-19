import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Esplêndida",
  description: "Cadastro, preço e venda de semijoias",
  applicationName: "Esplêndida",
};

export const viewport: Viewport = {
  themeColor: "#7a4b5c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
