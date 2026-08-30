import { v4 as uuidv4 } from "uuid";
import type { DeviceInfo, Room } from "./types.js";

const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour
const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private codeToRoomId = new Map<string, string>();
  private socketToDevice = new Map<string, { roomId: string; deviceId: string }>();

  createRoom(socketId: string, deviceName: string): { roomId: string; code: string; device: DeviceInfo } {
    let code = generateCode();
    // Ensure unique code
    while (this.codeToRoomId.has(code)) {
      code = generateCode();
    }

    const roomId = uuidv4();
    const deviceId = uuidv4();
    const now = Date.now();

    const device: DeviceInfo = {
      id: deviceId,
      name: deviceName || "Anonymous",
      socketId,
      joinedAt: now,
    };

    const room: Room = {
      id: roomId,
      code,
      devices: new Map([[deviceId, device]]),
      createdAt: now,
      lastActivity: now,
    };

    this.rooms.set(roomId, room);
    this.codeToRoomId.set(code, roomId);
    this.socketToDevice.set(socketId, { roomId, deviceId });

    return { roomId, code, device };
  }

  joinRoom(
    code: string,
    socketId: string,
    deviceName: string
  ): { roomId: string; code: string; device: DeviceInfo; devices: DeviceInfo[] } | { error: string } {
    const normalized = code.trim().toUpperCase();
    const roomId = this.codeToRoomId.get(normalized);
    if (!roomId) {
      return { error: "Room not found. Check the pairing code." };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.codeToRoomId.delete(normalized);
      return { error: "Room no longer exists." };
    }

    if (room.devices.size >= 8) {
      return { error: "Room is full (max 8 devices)." };
    }

    const deviceId = uuidv4();
    const now = Date.now();
    const device: DeviceInfo = {
      id: deviceId,
      name: deviceName || "Anonymous",
      socketId,
      joinedAt: now,
    };

    room.devices.set(deviceId, device);
    room.lastActivity = now;
    this.socketToDevice.set(socketId, { roomId, deviceId });

    return {
      roomId,
      code: room.code,
      device,
      devices: Array.from(room.devices.values()),
    };
  }

  leaveRoom(socketId: string): { roomId: string; deviceId: string; remaining: DeviceInfo[] } | null {
    const mapping = this.socketToDevice.get(socketId);
    if (!mapping) return null;

    const { roomId, deviceId } = mapping;
    this.socketToDevice.delete(socketId);

    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.devices.delete(deviceId);
    room.lastActivity = Date.now();

    if (room.devices.size === 0) {
      this.rooms.delete(roomId);
      this.codeToRoomId.delete(room.code);
      return { roomId, deviceId, remaining: [] };
    }

    return {
      roomId,
      deviceId,
      remaining: Array.from(room.devices.values()),
    };
  }

  getDeviceBySocket(socketId: string): { roomId: string; deviceId: string; room: Room; device: DeviceInfo } | null {
    const mapping = this.socketToDevice.get(socketId);
    if (!mapping) return null;
    const room = this.rooms.get(mapping.roomId);
    if (!room) return null;
    const device = room.devices.get(mapping.deviceId);
    if (!device) return null;
    return { roomId: mapping.roomId, deviceId: mapping.deviceId, room, device };
  }

  getSocketIdForDevice(roomId: string, deviceId: string): string | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const device = room.devices.get(deviceId);
    return device?.socketId ?? null;
  }

  getRoomDevices(roomId: string): DeviceInfo[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.devices.values()) : [];
  }

  touch(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) room.lastActivity = Date.now();
  }

  /** Remove rooms with no activity past TTL */
  cleanupStaleRooms(): number {
    const now = Date.now();
    let removed = 0;
    for (const [roomId, room] of this.rooms) {
      if (now - room.lastActivity > ROOM_TTL_MS) {
        for (const device of room.devices.values()) {
          this.socketToDevice.delete(device.socketId);
        }
        this.codeToRoomId.delete(room.code);
        this.rooms.delete(roomId);
        removed++;
      }
    }
    return removed;
  }

  stats(): { rooms: number; devices: number } {
    let devices = 0;
    for (const room of this.rooms.values()) {
      devices += room.devices.size;
    }
    return { rooms: this.rooms.size, devices };
  }
}
