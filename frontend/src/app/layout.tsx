import type { Metadata } from "next";
import { AuthProvider } from "./providers";
import "./globals.css";
import "@/index.css";

export const metadata: Metadata = {
  title: "EPEM - Cartera de Cobranzas",
  description: "Panel de análisis de cartera y cobranzas",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%2338bdf8' rx='6'/><text x='16' y='22' font-size='18' text-anchor='middle' fill='white'>E</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning data-scroll-behavior="smooth" data-theme="dark">
      <body className="min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
