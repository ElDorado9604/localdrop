import { randomBytes, randomInt } from "crypto";
import type { TransferRoom, RoomStatus } from "./types.js";

/** Room lives 5 minutes waiting for a receiver */
export const ROOM_WAIT_TTL_MS = 5 * 60 * 1000;

function generateRoomId(): string {
  return randomBytes(16).toString("hex");
}

function generatePairingCode(): string {
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export class RoomManager {
  private rooms = new Map<string, TransferRoom>();
  private codeToRoomId = new Map<string, string>();
  private socketToRoom = new Map<string, string>();

  createRoom(senderSocketId: string, senderName: string): TransferRoom {
    let pairingCode = generatePairingCode();
    while (this.codeToRoomId.has(pairingCode)) {
      pairingCode = generatePairingCode();
    }

    const now = Date.now();
    const room: TransferRoom = {
      roomId: generateRoomId(),
      pairingCode,
      createdAt: now,
      expiresAt: now + ROOM_WAIT_TTL_MS,
      senderSocketId,
      senderName: senderName || "Sender",
      status: "waiting",
    };

    this.rooms.set(room.roomId, room);
    this.codeToRoomId.set(pairingCode, room.roomId);
    this.socketToRoom.set(senderSocketId, room.roomId);
    return room;
  }

  joinRoom(
    pairingCode: string,
    receiverSocketId: string,
    receiverName: string
  ): { room: TransferRoom } | { error: string; code?: string } {
    const code = pairingCode.replace(/\D/g, "").padStart(6, "0").slice(-6);
    const roomId = this.codeToRoomId.get(code);
    if (!roomId) {
      return { error: "Room not found. Check the pairing code.", code: "NOT_FOUND" };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.codeToRoomId.delete(code);
      return { error: "Room no longer exists.", code: "GONE" };
    }

    if (Date.now() > room.expiresAt && room.status === "waiting") {
      this.deleteRoom(roomId);
      return { error: "Room expired. Ask the sender to create a new transfer.", code: "EXPIRED" };
    }

    if (room.status !== "waiting") {
      return { error: "This room is no longer accepting a receiver.", code: "BUSY" };
    }

    if (room.receiverSocketId) {
      return { error: "A receiver is already connected to this room.", code: "FULL" };
    }

    room.receiverSocketId = receiverSocketId;
    room.receiverName = receiverName || "Receiver";
    room.status = "paired";
    room.expiresAt = Date.now() + 30 * 60 * 1000;
    this.socketToRoom.set(receiverSocketId, roomId);

    return { room };
  }

  getRoom(roomId: string): TransferRoom | undefined {
    return this.rooms.get(roomId);
  }

  getRoomBySocket(socketId: string): TransferRoom | undefined {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getPeerSocketId(socketId: string): string | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    if (room.senderSocketId === socketId) return room.receiverSocketId ?? null;
    if (room.receiverSocketId === socketId) return room.senderSocketId ?? null;
    return null;
  }

  setStatus(roomId: string, status: RoomStatus): void {
    const room = this.rooms.get(roomId);
    if (room) room.status = status;
  }

  handleDisconnect(socketId: string): { room: TransferRoom; peerSocketId: string | null } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    this.socketToRoom.delete(socketId);
    if (!room) return null;

    let peerSocketId: string | null = null;
    if (room.senderSocketId === socketId) {
      peerSocketId = room.receiverSocketId ?? null;
      room.senderSocketId = undefined;
    } else if (room.receiverSocketId === socketId) {
      peerSocketId = room.senderSocketId ?? null;
      room.receiverSocketId = undefined;
    }

    if (!room.senderSocketId && !room.receiverSocketId) {
      this.deleteRoom(roomId);
      return { room, peerSocketId };
    }

    if (room.status === "waiting" && !room.senderSocketId) {
      this.deleteRoom(roomId);
      return { room, peerSocketId };
    }

    return { room, peerSocketId };
  }

  cancelRoom(roomId: string): TransferRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    room.status = "cancelled";
    this.deleteRoom(roomId);
    return room;
  }

  completeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.status = "completed";
    this.deleteRoom(roomId);
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.senderSocketId) this.socketToRoom.delete(room.senderSocketId);
    if (room.receiverSocketId) this.socketToRoom.delete(room.receiverSocketId);
    this.codeToRoomId.delete(room.pairingCode);
    this.rooms.delete(roomId);
  }

  cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [roomId, room] of this.rooms) {
      if (room.status === "waiting" && now > room.expiresAt) {
        this.deleteRoom(roomId);
        removed++;
      }
    }
    return removed;
  }

  stats(): { rooms: number } {
    return { rooms: this.rooms.size };
  }
}
