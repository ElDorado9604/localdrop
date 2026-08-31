import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import { resolveDeviceName, isAppleMobile } from "../lib/device";
import { normalizeCode, isValidCodeFormat } from "../lib/room";
import { supportsWebRTC } from "../lib/webrtc";
import { useWebRTC } from "../hooks/useWebRTC";
import { useTransfer } from "../hooks/useTransfer";
import { DeviceNameDialog } from "../components/DeviceNameDialog";
import { FileQueue } from "../components/FileQueue";
import { TransferProgress } from "../components/TransferProgress";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatBytes } from "../lib/formatters";

export function ReceivePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState("");
  const [showName, setShowName] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "joining" | "connecting" | "ready" | "done">("idle");
  const deviceNameRef = useRef(resolveDeviceName());
  const autoJoined = useRef(false);

  const webrtc = useWebRTC({
    sendSignal: (type, payload) => {
      const s = getSocket();
      if (type === "offer") s.emit("signal:offer", { sdp: payload as RTCSessionDescriptionInit });
      else if (type === "answer") s.emit("signal:answer", { sdp: payload as RTCSessionDescriptionInit });
      else s.emit("signal:ice-candidate", { candidate: payload as RTCIceCandidateInit });
    },
    onChannelOpen: () => setStatus("ready"),
    onChannelMessage: (data) => transfer.handleMessage(data),
    onLocalCheckFailed: () => {
      setError(
        "Local connection could not be established. Confirm that both devices are connected to the same Wi-Fi network or hotspot, then try again."
      );
    },
    onConnectionFailed: (reason) => setError(reason),
  });

  const transfer = useTransfer({
    getChannel: webrtc.getChannel,
    deviceName: deviceNameRef.current,
    onComplete: () => {
      setStatus("done");
      getSocket().emit("room:complete");
    },
    onCancelled: () => {
      setError("Transfer cancelled. No files were stored by this app.");
    },
    onError: (m) => setError(m),
  });

  useEffect(() => {
    if (!supportsWebRTC()) {
      setError("This browser does not support WebRTC DataChannels required for LocalDrop.");
      return;
    }
    const s = getSocket();
    if (!s.connected) s.connect();

    const onPeerLeft = () => setError("The other device disconnected.");
    const onCancelled = () => {
      setError("Transfer cancelled. No files were stored by this app.");
      setStatus("idle");
    };
    const onOffer = (p: { sdp: RTCSessionDescriptionInit }) => {
      setStatus("connecting");
      void webrtc.handleOffer(p.sdp);
    };
    const onAnswer = (p: { sdp: RTCSessionDescriptionInit }) => void webrtc.handleAnswer(p.sdp);
    const onIce = (p: { candidate: RTCIceCandidateInit }) => void webrtc.handleIce(p.candidate);

    s.on("room:peer-left", onPeerLeft);
    s.on("room:cancelled", onCancelled);
    s.on("signal:offer", onOffer);
    s.on("signal:answer", onAnswer);
    s.on("signal:ice-candidate", onIce);

    return () => {
      s.off("room:peer-left", onPeerLeft);
      s.off("room:cancelled", onCancelled);
      s.off("signal:offer", onOffer);
      s.off("signal:answer", onAnswer);
      s.off("signal:ice-candidate", onIce);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code && !autoJoined.current) {
      const n = normalizeCode(code);
      if (isValidCodeFormat(n)) {
        setCodeInput(n);
        setPendingCode(n);
        setShowName(true);
        autoJoined.current = true;
      }
    }
  }, [searchParams]);

  const join = useCallback((code: string, name: string) => {
    deviceNameRef.current = name;
    setShowName(false);
    setStatus("joining");
    setError(null);
    const s = getSocket();
    if (!s.connected) s.connect();
    s.emit("room:join", { pairingCode: code, deviceName: name }, (res) => {
      if ("error" in res) {
        setError(res.error);
        setStatus("idle");
        return;
      }
      setPeerName(res.peerName || "Sender");
      setStatus("connecting");
    });
  }, []);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = normalizeCode(codeInput);
    if (!isValidCodeFormat(n)) return;
    setPendingCode(n);
    setShowName(true);
  };

  const leave = () => {
    getSocket().emit("room:cancel");
    webrtc.close();
    transfer.clearQueue();
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
          \u2190 Home
        </Link>
        <span className="text-xs text-slate-500">Receive</span>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Receive files</h1>
      <p className="mt-1 text-sm text-slate-500">Enter the code shown on the sender\u2019s device.</p>

      {error && (
        <div className="mt-4">
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {status === "idle" && (
        <form onSubmit={handleCodeSubmit} className="mt-8 space-y-4">
          <input
            type="text"
            inputMode="numeric"
            value={codeInput}
            onChange={(e) => setCodeInput(normalizeCode(e.target.value))}
            placeholder="000 000"
            maxLength={6}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-center font-mono text-3xl tracking-[0.3em] text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            autoComplete="one-time-code"
          />
          <button
            type="submit"
            disabled={!isValidCodeFormat(codeInput)}
            className="w-full rounded-2xl bg-emerald-600 py-3.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Join room
          </button>
        </form>
      )}

      {status === "joining" && (
        <p className="mt-8 text-center text-slate-500">Joining room\u2026</p>
      )}

      {status === "connecting" && (
        <p className="mt-8 text-center text-slate-500 animate-pulse">Connecting locally\u2026</p>
      )}

      {(status === "ready" ||
        status === "done" ||
        transfer.phase === "offering" ||
        transfer.phase === "transferring" ||
        transfer.phase === "completed") && (
        <div className="mt-6 space-y-6">
          {peerName && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Connected to {peerName}
              </p>
            </div>
          )}

          {transfer.offer && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-semibold text-slate-900 dark:text-white">Incoming transfer</h2>
              <p className="mt-1 text-sm text-slate-500">
                From {transfer.offer.senderName} \u00b7 {transfer.offer.files.length} file
                {transfer.offer.files.length !== 1 ? "s" : ""} \u00b7{" "}
                {formatBytes(transfer.offer.totalSize)}
              </p>
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-slate-600 dark:text-slate-300">
                {transfer.offer.files.map((f) => (
                  <li key={f.id} className="flex justify-between gap-2">
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-slate-400">{formatBytes(f.size)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => transfer.rejectOffer()}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm dark:border-slate-600"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => transfer.acceptOffer()}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white"
                >
                  Accept
                </button>
              </div>
            </div>
          )}

          {transfer.phase === "transferring" && (
            <TransferProgress
              bytesDone={transfer.bytesDone}
              bytesTotal={transfer.bytesTotal}
              speed={transfer.speed}
              label="Receiving\u2026"
            />
          )}

          <FileQueue
            files={transfer.queue}
            onDownload={transfer.downloadFile}
            onShare={transfer.shareFile}
          />

          {status === "done" || transfer.phase === "completed" ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                Transfer complete
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Use Download on each file, Save to Photos for images, or grab everything as a ZIP.
              </p>
              {transfer.queue.some(
                (f) => f.status === "completed" && f.direction === "receive"
              ) && (
                <button
                  type="button"
                  onClick={() => void transfer.downloadAllZip()}
                  className="mt-4 w-full rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Download all as ZIP
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-3 rounded-xl bg-slate-900 px-6 py-2.5 text-sm text-white dark:bg-white dark:text-slate-900"
              >
                Done
              </button>
            </div>
          ) : (
            transfer.phase === "transferring" && (
              <button
                type="button"
                onClick={() => transfer.cancel()}
                className="w-full rounded-xl border border-slate-300 py-2.5 text-sm dark:border-slate-600"
              >
                Cancel
              </button>
            )
          )}

          {isAppleMobile() && (
            <p className="text-center text-xs text-amber-700 dark:text-amber-300/90">
              Keep this page open and keep the screen awake during large transfers.
            </p>
          )}

          {status !== "done" && transfer.phase !== "completed" && (
            <button
              type="button"
              onClick={leave}
              className="w-full rounded-xl border border-slate-300 py-2.5 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              Leave
            </button>
          )}
        </div>
      )}

      <DeviceNameDialog
        open={showName}
        onConfirm={(name) => {
          if (pendingCode) join(pendingCode, name);
        }}
        onCancel={() => {
          setShowName(false);
          setPendingCode(null);
        }}
      />
    </div>
  );
}
