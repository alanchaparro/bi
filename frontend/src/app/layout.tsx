import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AuthProvider } from "./providers";
import "./globals.css";
import "@/index.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-headline",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

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
    <html
      lang="es"
      className={`dark ${manrope.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      data-theme="dark"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300..700,0..1,0..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
