import type { RoomManager } from "./roomManager.js";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

export function startCleanupScheduler(roomManager: RoomManager): NodeJS.Timeout {
  const timer = setInterval(() => {
    const removed = roomManager.cleanupStaleRooms();
    if (removed > 0) {
      const stats = roomManager.stats();
      console.log(
        `[cleanup] Removed ${removed} stale room(s). Active: ${stats.rooms} rooms, ${stats.devices} devices`
      );
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't keep process alive solely for this timer
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return timer;
}
