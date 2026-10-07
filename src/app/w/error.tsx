"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

/** Pega erros do cabeçalho do workspace (layout), que o error.tsx de dentro não alcança. */
export default function WorkspaceShellError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
