export interface DeviceInfo {
  id: string;
  name: string;
  socketId: string;
  joinedAt: number;
}

export interface FileMeta {
  name: string;
  size: number;
  type: string;
}

export interface QueuedFile {
  id: string;
  file: File;
  status: "pending" | "sending" | "receiving" | "completed" | "error" | "cancelled";
  progress: number; // 0–100
  error?: string;
  direction: "send" | "receive";
}

export interface TransferRequest {
  transferId: string;
  from: string;
  files: FileMeta[];
}

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "in-room"
  | "error";

export type PeerConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export interface RoomState {
  roomId: string | null;
  code: string | null;
  devices: DeviceInfo[];
  myDeviceId: string | null;
}
