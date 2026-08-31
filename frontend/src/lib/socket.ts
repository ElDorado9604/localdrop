import { io, Socket } from "socket.io-client";

export interface ServerToClientEvents {
  "room:peer-joined": (payload: { peerName: string; role: "sender" | "receiver" }) => void;
  "room:peer-left": (payload: { reason?: string }) => void;
  "room:expired": () => void;
  "room:cancelled": (payload: { by: "sender" | "receiver" }) => void;
  "room:error": (payload: { message: string; code?: string }) => void;
  "signal:offer": (payload: { sdp: RTCSessionDescriptionInit }) => void;
  "signal:answer": (payload: { sdp: RTCSessionDescriptionInit }) => void;
  "signal:ice-candidate": (payload: { candidate: RTCIceCandidateInit }) => void;
  "transfer:started": () => void;
  "transfer:completed": () => void;
}

export interface ClientToServerEvents {
  "room:create": (
    payload: { deviceName: string },
    callback: (
      res: { roomId: string; pairingCode: string; expiresAt: number } | { error: string }
    ) => void
  ) => void;
  "room:join": (
    payload: { pairingCode: string; deviceName: string },
    callback: (
      res: { roomId: string; pairingCode: string; peerName?: string } | { error: string }
    ) => void
  ) => void;
  "room:rejoin": (
    payload: { pairingCode: string; role: "sender" | "receiver"; deviceName: string },
    callback: (
      res: { roomId: string; pairingCode: string; peerName?: string } | { error: string }
    ) => void
  ) => void;
  "room:cancel": () => void;
  "room:complete": () => void;
  "signal:offer": (payload: { sdp: RTCSessionDescriptionInit }) => void;
  "signal:answer": (payload: { sdp: RTCSessionDescriptionInit }) => void;
  "signal:ice-candidate": (payload: { candidate: RTCIceCandidateInit }) => void;
  "transfer:started": () => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function resolveSocketUrl(): string | undefined {
  const raw = import.meta.env.VITE_SOCKET_URL;
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}

const SOCKET_URL = resolveSocketUrl();

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
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
