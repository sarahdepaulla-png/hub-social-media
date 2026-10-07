"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <ErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
