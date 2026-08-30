import { io, Socket } from "socket.io-client";
import type { DeviceInfo } from "../types/transfer";

export interface ServerToClientEvents {
  "room:joined": (payload: { roomId: string; code: string; devices: DeviceInfo[] }) => void;
  "room:device-joined": (device: DeviceInfo) => void;
  "room:device-left": (payload: { deviceId: string }) => void;
  "room:error": (payload: { message: string }) => void;
  "signal:offer": (payload: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  "signal:answer": (payload: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  "signal:ice-candidate": (payload: { from: string; candidate: RTCIceCandidateInit }) => void;
  "transfer:request": (payload: {
    from: string;
    transferId: string;
    files: { name: string; size: number; type: string }[];
  }) => void;
  "transfer:accept": (payload: { from: string; transferId: string }) => void;
  "transfer:reject": (payload: { from: string; transferId: string; reason?: string }) => void;
}

export interface ClientToServerEvents {
  "room:create": (
    payload: { deviceName: string },
    callback: (res: { roomId: string; code: string } | { error: string }) => void
  ) => void;
  "room:join": (
    payload: { code: string; deviceName: string },
    callback: (
      res: { roomId: string; code: string; devices: DeviceInfo[] } | { error: string }
    ) => void
  ) => void;
  "room:leave": () => void;
  "signal:offer": (payload: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  "signal:answer": (payload: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  "signal:ice-candidate": (payload: { to: string; candidate: RTCIceCandidateInit }) => void;
  "transfer:request": (payload: {
    to: string;
    transferId: string;
    files: { name: string; size: number; type: string }[];
  }) => void;
  "transfer:accept": (payload: { to: string; transferId: string }) => void;
  "transfer:reject": (payload: { to: string; transferId: string; reason?: string }) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
