import type { Metadata, Viewport } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import "@fontsource-variable/inter-tight";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { TrashToastHost } from "@/components/Trash";

export const metadata: Metadata = {
  title: { default: "Hub Social Media", template: "%s | Hub Social Media" },
  description: "Planejamento, aprovação e ideias do seu conteúdo em um só lugar.",
};

export const viewport: Viewport = {
  themeColor: "#FF8DC7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="pt-BR">
        <body className="min-h-dvh antialiased">
          <ConvexClientProvider>
            {children}
            <TrashToastHost />
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
