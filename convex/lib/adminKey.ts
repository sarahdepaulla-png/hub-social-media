/**
 * Chave fixa de entrada da admin. Só o hash fica no código (o repositório é público);
 * o link com a chave foi entregue à Sarah. Para trocar, gere outra chave e troque o hash.
 */
export const ADMIN_KEYS: { email: string; sha256: string }[] = [
  { email: "sarahdepaulla@gmail.com", sha256: "0018723100a9c7114f922460d995674aabaef67519b89c2a3058adaf4d2f756e" },
];

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
