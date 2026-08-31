export function normalizeCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}

export function isValidCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(normalizeCode(code));
}

export function formatCodeForDisplay(code: string): string {
  const n = normalizeCode(code);
  if (n.length !== 6) return n;
  return `${n.slice(0, 3)} ${n.slice(3)}`;
}

export function buildJoinUrl(code: string): string {
  if (typeof window === "undefined") return code;
  const url = new URL("/receive", window.location.origin);
  url.searchParams.set("code", normalizeCode(code));
  return url.toString();
}
