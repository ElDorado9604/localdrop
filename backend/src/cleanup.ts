import type { RoomManager } from "./roomManager.js";

const CLEANUP_INTERVAL_MS = 30 * 1000;

export function startCleanupScheduler(roomManager: RoomManager): NodeJS.Timeout {
  const timer = setInterval(() => {
    roomManager.cleanupExpired();
  }, CLEANUP_INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return timer;
}
