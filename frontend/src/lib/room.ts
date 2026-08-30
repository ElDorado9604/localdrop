/** Normalize pairing code input (uppercase, strip spaces/dashes) */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidCodeFormat(code: string): boolean {
  const normalized = normalizeCode(code);
  return /^[A-Z0-9]{6}$/.test(normalized);
}

export function formatCodeForDisplay(code: string): string {
  const n = normalizeCode(code);
  if (n.length !== 6) return n;
  return `${n.slice(0, 3)}-${n.slice(3)}`;
}
