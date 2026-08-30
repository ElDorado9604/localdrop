const DEVICE_NAME_KEY = "localdrop_device_name";

export function getStoredDeviceName(): string | null {
  try {
    return localStorage.getItem(DEVICE_NAME_KEY);
  } catch {
    return null;
  }
}

export function setStoredDeviceName(name: string): void {
  try {
    localStorage.setItem(DEVICE_NAME_KEY, name.trim());
  } catch {
    // ignore
  }
}

export function getDefaultDeviceName(): string {
  if (typeof navigator === "undefined") return "Device";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux";
  return "Device";
}

export function resolveDeviceName(): string {
  return getStoredDeviceName() || getDefaultDeviceName();
}
