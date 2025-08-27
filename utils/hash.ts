export async function workspaceHash(
  server: string,
  key: string,
  accountId: string,
  phoneId: string
): Promise<string> {
  const data = new TextEncoder().encode(`${server}${key}${accountId}${phoneId}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}