export type RoomStatus = "waiting" | "paired" | "transferring" | "completed" | "cancelled";

export interface TransferRoom {
  roomId: string;
  pairingCode: string;
  createdAt: number;
  expiresAt: number;
  senderSocketId?: string;
  receiverSocketId?: string;
  senderName?: string;
  receiverName?: string;
  status: RoomStatus;
}

export interface ServerToClientEvents {
  "room:created": (payload: { roomId: string; pairingCode: string; expiresAt: number }) => void;
  "room:joined": (payload: {
    roomId: string;
    pairingCode: string;
    role: "sender" | "receiver";
    peerName?: string;
  }) => void;
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
    callback: (res: { roomId: string; pairingCode: string; expiresAt: number } | { error: string }) => void
  ) => void;
  "room:join": (
    payload: { pairingCode: string; deviceName: string },
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

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  roomId: string | null;
  role: "sender" | "receiver" | null;
  deviceName: string;
}
