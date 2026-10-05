"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { buttonClass } from "./brand";

export function SignOutButton({ variant = "outline" }: { variant?: "outline" | "link" }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const onClick = async () => {
    await signOut();
    router.replace("/entrar");
  };
  if (variant === "link") {
    return (
      <button type="button" onClick={onClick} className="min-h-11 text-sm font-semibold text-texto-2 hover:text-vinho">
        Sair
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} className={buttonClass.outline}>
      Sair
    </button>
  );
}
