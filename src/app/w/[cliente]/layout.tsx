import { WorkspaceShell } from "@/components/WorkspaceShell";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cliente: string }>;
}) {
  const { cliente } = await params;
  return <WorkspaceShell slug={cliente}>{children}</WorkspaceShell>;
}
