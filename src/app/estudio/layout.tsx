import Link from "next/link";
import { Logo } from "@/components/brand";
import { SignOutButton } from "@/components/SignOutButton";
import { StudioNav } from "@/components/StudioNav";

export const metadata = { title: "Estúdio" };

export default function EstudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 pt-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/estudio" aria-label="Estúdio, visão geral">
              <Logo />
            </Link>
            <SignOutButton variant="link" />
          </div>
          <StudioNav />
        </div>
      </header>
      {children}
    </div>
  );
}
