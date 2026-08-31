export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "in-room"
  | "error";

export type TransferPhase =
  | "idle"
  | "waiting"
  | "pairing"
  | "negotiating"
  | "ready"
  | "offering"
  | "transferring"
  | "completed"
  | "cancelled"
  | "failed";

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface QueuedFile {
  id: string;
  file?: File;
  name: string;
  size: number;
  type: string;
  status: "pending" | "sending" | "receiving" | "completed" | "error" | "cancelled";
  progress: number;
  error?: string;
  direction: "send" | "receive";
  bytesDone: number;
  /** Object URL for a received file (revoked on clear) */
  blobUrl?: string;
}

export interface TransferOffer {
  files: FileMeta[];
  totalSize: number;
  senderName: string;
}

export interface RoomInfo {
  roomId: string | null;
  pairingCode: string | null;
  expiresAt: number | null;
  peerName: string | null;
  role: "sender" | "receiver" | null;
}

/** Protocol messages over the DataChannel (JSON except binary chunks) */
export type ProtocolMessage =
  | { type: "transfer-offer"; files: FileMeta[]; totalSize: number; senderName: string }
  | { type: "transfer-accepted" }
  | { type: "transfer-rejected"; reason?: string }
  | {
      type: "file-start";
      fileId: string;
      name: string;
      mime: string;
      size: number;
      lastModified: number;
      index: number;
      totalFiles: number;
    }
  | { type: "file-complete"; fileId: string }
  | { type: "transfer-complete" }
  | { type: "transfer-cancelled"; reason?: string }
  | { type: "transfer-error"; message: string };

/** Max single file size for safe browser transfers (500 MB) */
export const MAX_FILE_SIZE = 500 * 1024 * 1024;
/** Soft warning threshold (100 MB) */
export const WARN_FILE_SIZE = 100 * 1024 * 1024;
