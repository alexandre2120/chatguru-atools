export function toFormUrlEncoded(body: Record<string, string>): string {
  return new URLSearchParams(body).toString();
}