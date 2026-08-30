import { useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { QueuedFile, FileMeta } from "../types/transfer";
import type { DataChannelMessage } from "../lib/webrtc";
import { chunkFile, CHUNK_SIZE } from "../lib/webrtc";

interface UseFileTransferOptions {
  sendMessage: (deviceId: string, msg: DataChannelMessage) => boolean;
  createOffer: (deviceId: string) => Promise<void>;
  sendTransferRequest: (
    to: string,
    transferId: string,
    files: FileMeta[]
  ) => void;
}

interface IncomingBuffers {
  meta: { name: string; size: number; mime: string };
  chunks: Map<number, ArrayBuffer>;
  received: number;
  totalChunks: number;
}

export function useFileTransfer(options: UseFileTransferOptions) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const incomingRef = useRef<Map<string, IncomingBuffers>>(new Map());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateFile = useCallback((id: string, patch: Partial<QueuedFile>) => {
    setQueue((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const addFilesToSend = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    const newItems: QueuedFile[] = list.map((file) => ({
      id: uuidv4(),
      file,
      status: "pending",
      progress: 0,
      direction: "send",
    }));
    setQueue((prev) => [...prev, ...newItems]);
    return newItems;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((f) => f.status !== "completed"));
  }, []);

  /** Start sending all pending files to a peer (establishes data channel if needed) */
  const startSend = useCallback(
    async (remoteDeviceId: string) => {
      const pending = queue.filter((f) => f.direction === "send" && f.status === "pending");
      if (pending.length === 0) return;

      const transferId = uuidv4();
      const metas: FileMeta[] = pending.map((q) => ({
        name: q.file.name,
        size: q.file.size,
        type: q.file.type || "application/octet-stream",
      }));

      // Request transfer acceptance via signaling
      optionsRef.current.sendTransferRequest(remoteDeviceId, transferId, metas);

      // Initiate WebRTC if needed
      await optionsRef.current.createOffer(remoteDeviceId);

      const trySend = async () => {
        for (const item of pending) {
          updateFile(item.id, { status: "sending", progress: 0 });

          const started = optionsRef.current.sendMessage(remoteDeviceId, {
            type: "file-start",
            fileId: item.id,
            name: item.file.name,
            size: item.file.size,
            mime: item.file.type || "application/octet-stream",
          });

          if (!started) {
            await new Promise((r) => setTimeout(r, 500));
            const retry = optionsRef.current.sendMessage(remoteDeviceId, {
              type: "file-start",
              fileId: item.id,
              name: item.file.name,
              size: item.file.size,
              mime: item.file.type || "application/octet-stream",
            });
            if (!retry) {
              updateFile(item.id, { status: "error", error: "Data channel not open" });
              continue;
            }
          }

          try {
            let sent = 0;
            for await (const { index, data, total } of chunkFile(item.file)) {
              const ok = optionsRef.current.sendMessage(remoteDeviceId, {
                type: "file-chunk",
                fileId: item.id,
                index,
                data,
              });
              if (!ok) {
                updateFile(item.id, { status: "error", error: "Send failed" });
                break;
              }
              sent++;
              const progress = Math.round((sent / total) * 100);
              updateFile(item.id, { progress });
            }
            optionsRef.current.sendMessage(remoteDeviceId, {
              type: "file-end",
              fileId: item.id,
            });
            updateFile(item.id, { status: "completed", progress: 100 });
          } catch (err) {
            updateFile(item.id, {
              status: "error",
              error: err instanceof Error ? err.message : "Transfer failed",
            });
          }
        }
      };

      setTimeout(trySend, 800);
    },
    [queue, updateFile]
  );

  const handleDataChannelMessage = useCallback(
    (from: string, msg: DataChannelMessage) => {
      if (msg.type === "file-start") {
        const totalChunks = Math.ceil(msg.size / CHUNK_SIZE) || 1;
        incomingRef.current.set(msg.fileId, {
          meta: { name: msg.name, size: msg.size, mime: msg.mime },
          chunks: new Map(),
          received: 0,
          totalChunks,
        });

        const placeholder = new File([], msg.name, { type: msg.mime });
        setQueue((prev) => [
          ...prev,
          {
            id: msg.fileId,
            file: placeholder,
            status: "receiving",
            progress: 0,
            direction: "receive",
          },
        ]);
      } else if (msg.type === "file-chunk") {
        const buf = incomingRef.current.get(msg.fileId);
        if (!buf) return;
        buf.chunks.set(msg.index, msg.data);
        buf.received++;
        const progress = Math.round((buf.received / buf.totalChunks) * 100);
        updateFile(msg.fileId, { progress: Math.min(progress, 99) });
      } else if (msg.type === "file-end") {
        const buf = incomingRef.current.get(msg.fileId);
        if (!buf) return;

        const ordered: ArrayBuffer[] = [];
        for (let i = 0; i < buf.totalChunks; i++) {
          const chunk = buf.chunks.get(i);
          if (!chunk) {
            updateFile(msg.fileId, { status: "error", error: "Missing chunks" });
            incomingRef.current.delete(msg.fileId);
            return;
          }
          ordered.push(chunk);
        }

        const blob = new Blob(ordered, { type: buf.meta.mime });
        const file = new File([blob], buf.meta.name, { type: buf.meta.mime });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = buf.meta.name;
        a.click();
        URL.revokeObjectURL(url);

        updateFile(msg.fileId, {
          status: "completed",
          progress: 100,
          file,
        });
        incomingRef.current.delete(msg.fileId);
      } else if (msg.type === "cancel") {
        incomingRef.current.delete(msg.fileId);
        updateFile(msg.fileId, { status: "cancelled" });
      }
    },
    [updateFile]
  );

  const cancelFile = useCallback(
    (id: string, remoteDeviceId?: string) => {
      updateFile(id, { status: "cancelled" });
      incomingRef.current.delete(id);
      if (remoteDeviceId) {
        optionsRef.current.sendMessage(remoteDeviceId, { type: "cancel", fileId: id });
      }
    },
    [updateFile]
  );

  return {
    queue,
    addFilesToSend,
    removeFromQueue,
    clearCompleted,
    startSend,
    handleDataChannelMessage,
    cancelFile,
  };
}
