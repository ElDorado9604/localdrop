import { useState, useCallback, useRef } from "react";
import type { FileMeta, QueuedFile, ProtocolMessage, TransferOffer } from "../types/transfer";
import { MAX_FILE_SIZE } from "../types/transfer";
import { chunkFile, waitForBuffer, CHUNK_SIZE } from "../lib/webrtc";
import { downloadBlob, shareBlob, blobsToZip } from "../lib/download";

function randomId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface UseTransferOptions {
  getChannel: () => RTCDataChannel | null;
  deviceName: string;
  onComplete?: () => void;
  onCancelled?: () => void;
  onError?: (message: string) => void;
}

export function useTransfer(options: UseTransferOptions) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [offer, setOffer] = useState<TransferOffer | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "offering" | "awaiting-accept" | "transferring" | "completed" | "failed"
  >("idle");
  const [bytesTotal, setBytesTotal] = useState(0);
  const [bytesDone, setBytesDone] = useState(0);
  const [speed, setSpeed] = useState(0);

  const incomingRef = useRef<
    Map<string, { meta: FileMeta; chunks: Map<number, ArrayBuffer>; received: number; totalChunks: number }>
  >(new Map());
  const blobsRef = useRef<Map<string, Blob>>(new Map());
  const startTimeRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const cancelledRef = useRef(false);

  const updateFile = useCallback((id: string, patch: Partial<QueuedFile>) => {
    setQueue((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    const items: QueuedFile[] = [];
    for (const file of list) {
      if (file.size > MAX_FILE_SIZE) {
        items.push({
          id: randomId(),
          file,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          status: "error",
          progress: 0,
          direction: "send",
          bytesDone: 0,
          error: `File too large (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB)`,
        });
        continue;
      }
      items.push({
        id: randomId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        status: "pending",
        progress: 0,
        direction: "send",
        bytesDone: 0,
      });
    }
    setQueue((prev) => [...prev, ...items]);
    return items;
  }, []);

  const removeFile = useCallback((id: string) => {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue((prev) => {
      for (const f of prev) {
        if (f.blobUrl) URL.revokeObjectURL(f.blobUrl);
      }
      return [];
    });
    setOffer(null);
    setPhase("idle");
    setBytesTotal(0);
    setBytesDone(0);
    setSpeed(0);
    incomingRef.current.clear();
    blobsRef.current.clear();
  }, []);

  const sendJson = useCallback((msg: ProtocolMessage): boolean => {
    const ch = optionsRef.current.getChannel();
    if (!ch || ch.readyState !== "open") return false;
    ch.send(JSON.stringify(msg));
    return true;
  }, []);

  const startSend = useCallback(async () => {
    const pending = queue.filter((f) => f.direction === "send" && f.status === "pending" && f.file);
    if (pending.length === 0) return;

    cancelledRef.current = false;
    const metas: FileMeta[] = pending.map((q) => ({
      id: q.id,
      name: q.name,
      size: q.size,
      type: q.type,
      lastModified: q.file?.lastModified ?? Date.now(),
    }));
    const totalSize = metas.reduce((s, m) => s + m.size, 0);
    setBytesTotal(totalSize);
    setBytesDone(0);
    setPhase("awaiting-accept");

    const ok = sendJson({
      type: "transfer-offer",
      files: metas,
      totalSize,
      senderName: optionsRef.current.deviceName,
    });
    if (!ok) {
      setPhase("failed");
      optionsRef.current.onError?.("Data channel not ready");
    }
  }, [queue, sendJson]);

  const runSend = useCallback(async () => {
    const pending = queue.filter((f) => f.direction === "send" && f.status === "pending" && f.file);
    setPhase("transferring");
    startTimeRef.current = Date.now();
    let done = 0;

    for (let i = 0; i < pending.length; i++) {
      if (cancelledRef.current) break;
      const item = pending[i];
      const file = item.file!;
      updateFile(item.id, { status: "sending", progress: 0 });

      sendJson({
        type: "file-start",
        fileId: item.id,
        name: item.name,
        mime: item.type,
        size: item.size,
        lastModified: file.lastModified,
        index: i,
        totalFiles: pending.length,
      });

      try {
        let sentChunks = 0;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
        for await (const { data } of chunkFile(file)) {
          if (cancelledRef.current) break;
          const ch = optionsRef.current.getChannel();
          if (!ch || ch.readyState !== "open") {
            updateFile(item.id, { status: "error", error: "Connection lost" });
            setPhase("failed");
            return;
          }
          await waitForBuffer(ch);
          ch.send(data);
          sentChunks++;
          done += data.byteLength;
          const progress = Math.round((sentChunks / totalChunks) * 100);
          updateFile(item.id, { progress, bytesDone: Math.min(done, item.size) });
          setBytesDone(done);
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          if (elapsed > 0.2) setSpeed(done / elapsed);
        }

        sendJson({ type: "file-complete", fileId: item.id });
        updateFile(item.id, { status: "completed", progress: 100, bytesDone: item.size });
      } catch (err) {
        updateFile(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Send failed",
        });
        setPhase("failed");
        sendJson({ type: "transfer-error", message: "Send failed" });
        return;
      }
    }

    if (!cancelledRef.current) {
      sendJson({ type: "transfer-complete" });
      setPhase("completed");
      optionsRef.current.onComplete?.();
    }
  }, [queue, sendJson, updateFile]);

  const acceptOffer = useCallback(() => {
    sendJson({ type: "transfer-accepted" });
    setPhase("transferring");
    startTimeRef.current = Date.now();
    setOffer(null);
  }, [sendJson]);

  const rejectOffer = useCallback((reason?: string) => {
    sendJson({ type: "transfer-rejected", reason });
    setOffer(null);
    setPhase("idle");
  }, [sendJson]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    sendJson({ type: "transfer-cancelled" });
    setPhase("idle");
    optionsRef.current.onCancelled?.();
  }, [sendJson]);

  const handleMessage = useCallback(
    (data: ArrayBuffer | string) => {
      if (typeof data !== "string") {
        let activeId: string | null = null;
        for (const [id, buf] of incomingRef.current) {
          if (buf.received < buf.totalChunks) {
            activeId = id;
            break;
          }
        }
        if (!activeId) {
          for (const [id] of incomingRef.current) {
            activeId = id;
            break;
          }
        }
        if (!activeId) return;
        const buf = incomingRef.current.get(activeId);
        if (!buf) return;
        const index = buf.received;
        buf.chunks.set(index, data);
        buf.received++;
        const progress = Math.round((buf.received / buf.totalChunks) * 100);
        const bytes = Math.min(buf.received * CHUNK_SIZE, buf.meta.size);
        updateFile(activeId, { progress: Math.min(progress, 99), bytesDone: bytes });
        setBytesDone((prev) => {
          const next = prev + data.byteLength;
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          if (elapsed > 0.2) setSpeed(next / elapsed);
          return next;
        });
        return;
      }

      let msg: ProtocolMessage;
      try {
        msg = JSON.parse(data) as ProtocolMessage;
      } catch {
        return;
      }

      if (msg.type === "transfer-offer") {
        setOffer({
          files: msg.files,
          totalSize: msg.totalSize,
          senderName: msg.senderName,
        });
        setBytesTotal(msg.totalSize);
        setPhase("offering");
        setQueue(
          msg.files.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            status: "pending" as const,
            progress: 0,
            direction: "receive" as const,
            bytesDone: 0,
          }))
        );
      } else if (msg.type === "transfer-accepted") {
        void runSend();
      } else if (msg.type === "transfer-rejected") {
        setPhase("idle");
        optionsRef.current.onError?.("Receiver declined the transfer.");
      } else if (msg.type === "file-start") {
        const totalChunks = Math.ceil(msg.size / CHUNK_SIZE) || 1;
        incomingRef.current.set(msg.fileId, {
          meta: {
            id: msg.fileId,
            name: msg.name,
            size: msg.size,
            type: msg.mime,
            lastModified: msg.lastModified,
          },
          chunks: new Map(),
          received: 0,
          totalChunks,
        });
        setQueue((prev) => {
          const exists = prev.some((f) => f.id === msg.fileId);
          if (exists) {
            return prev.map((f) =>
              f.id === msg.fileId ? { ...f, status: "receiving", progress: 0 } : f
            );
          }
          return [
            ...prev,
            {
              id: msg.fileId,
              name: msg.name,
              size: msg.size,
              type: msg.mime,
              status: "receiving" as const,
              progress: 0,
              direction: "receive" as const,
              bytesDone: 0,
            },
          ];
        });
        setPhase("transferring");
      } else if (msg.type === "file-complete") {
        const buf = incomingRef.current.get(msg.fileId);
        if (!buf) return;
        const ordered: ArrayBuffer[] = [];
        for (let i = 0; i < buf.totalChunks; i++) {
          const c = buf.chunks.get(i);
          if (!c) {
            updateFile(msg.fileId, { status: "error", error: "Missing chunks" });
            incomingRef.current.delete(msg.fileId);
            return;
          }
          ordered.push(c);
        }
        const blob = new Blob(ordered, { type: buf.meta.type || "application/octet-stream" });
        blobsRef.current.set(msg.fileId, blob);
        const url = URL.createObjectURL(blob);
        updateFile(msg.fileId, {
          status: "completed",
          progress: 100,
          bytesDone: buf.meta.size,
          blobUrl: url,
        });
        incomingRef.current.delete(msg.fileId);
      } else if (msg.type === "transfer-complete") {
        setPhase("completed");
        optionsRef.current.onComplete?.();
      } else if (msg.type === "transfer-cancelled") {
        cancelledRef.current = true;
        setPhase("idle");
        optionsRef.current.onCancelled?.();
      } else if (msg.type === "transfer-error") {
        setPhase("failed");
        optionsRef.current.onError?.(msg.message);
      }
    },
    [runSend, updateFile]
  );

  const downloadFile = useCallback(
    (id: string) => {
      const blob = blobsRef.current.get(id);
      const item = queue.find((f) => f.id === id);
      if (!blob || !item) return;
      downloadBlob(blob, item.name);
    },
    [queue]
  );

  const shareFile = useCallback(
    async (id: string) => {
      const blob = blobsRef.current.get(id);
      const item = queue.find((f) => f.id === id);
      if (!blob || !item) return;
      await shareBlob(blob, item.name);
    },
    [queue]
  );

  const downloadAllZip = useCallback(async () => {
    const items = queue.filter(
      (f) => f.status === "completed" && f.direction === "receive" && blobsRef.current.has(f.id)
    );
    if (items.length === 0) return;
    if (items.length === 1) {
      downloadFile(items[0].id);
      return;
    }
    const files = items.map((f) => ({
      name: f.name,
      blob: blobsRef.current.get(f.id)!,
    }));
    const zipBlob = await blobsToZip(files);
    downloadBlob(zipBlob, `localdrop-${Date.now()}.zip`);
  }, [queue, downloadFile]);

  return {
    queue,
    offer,
    phase,
    bytesTotal,
    bytesDone,
    speed,
    addFiles,
    removeFile,
    clearQueue,
    startSend,
    acceptOffer,
    rejectOffer,
    cancel,
    handleMessage,
    downloadFile,
    shareFile,
    downloadAllZip,
  };
}
