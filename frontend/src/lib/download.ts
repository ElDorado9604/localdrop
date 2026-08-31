/** Browser download / share helpers (iOS-friendly). */

export function isImageMime(type: string, name?: string): boolean {
  if (type.startsWith("image/")) return true;
  if (!name) return false;
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i.test(name);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Open system share sheet (on iOS: Save Image → Photos when sharing an image file). */
export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  try {
    const file = new File([blob], filename, {
      type: blob.type || "application/octet-stream",
    });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return true;
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return false;
  }
  downloadBlob(blob, filename);
  return false;
}

export async function blobsToZip(
  files: { name: string; blob: Blob }[]
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Map<string, number>();
  for (const f of files) {
    let name = f.name || "file";
    const count = used.get(name) ?? 0;
    used.set(name, count + 1);
    if (count > 0) {
      const dot = name.lastIndexOf(".");
      name =
        dot > 0
          ? `${name.slice(0, dot)} (${count})${name.slice(dot)}`
          : `${name} (${count})`;
    }
    zip.file(name, f.blob);
  }
  return zip.generateAsync({ type: "blob" });
}
