import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import { resolveDeviceName, isAppleMobile } from "../lib/device";
import { supportsWebRTC } from "../lib/webrtc";
import { useWebRTC } from "../hooks/useWebRTC";
import { useTransfer } from "../hooks/useTransfer";
import { DeviceNameDialog } from "../components/DeviceNameDialog";
import { PairingCode } from "../components/PairingCode";
import { QRPairing } from "../components/QRPairing";
import { FilePicker } from "../components/FilePicker";
import { FileQueue } from "../components/FileQueue";
import { TransferProgress } from "../components/TransferProgress";
import { ErrorMessage } from "../components/ErrorMessage";

export function SendPage() {
  const navigate = useNavigate();
  const [showName, setShowName] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "waiting" | "paired" | "done">("idle");
  const deviceNameRef = useRef(resolveDeviceName());

  const webrtc = useWebRTC({
    sendSignal: (type, payload) => {
      const s = getSocket();
      if (type === "offer") s.emit("signal:offer", { sdp: payload as RTCSessionDescriptionInit });
      else if (type === "answer") s.emit("signal:answer", { sdp: payload as RTCSessionDescriptionInit });
      else s.emit("signal:ice-candidate", { candidate: payload as RTCIceCandidateInit });
    },
    onChannelOpen: () => {
      setStatus("paired");
      setError(null);
    },
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

    const onPeerJoined = (p: { peerName: string }) => {
      setPeerName(p.peerName);
      setStatus("paired");
      window.setTimeout(() => {
        void webrtc.createOffer();
      }, 400);
    };
    const onPeerLeft = () => {
      setPeerName(null);
      setError("The other device disconnected.");
      setStatus((st) => (st === "waiting" ? "waiting" : "idle"));
    };
    const onCancelled = () => {
      setError("Transfer cancelled. No files were stored by this app.");
      setStatus("idle");
      setPairingCode(null);
    };
    const onOffer = (p: { sdp: RTCSessionDescriptionInit }) => void webrtc.handleOffer(p.sdp);
    const onAnswer = (p: { sdp: RTCSessionDescriptionInit }) => void webrtc.handleAnswer(p.sdp);
    const onIce = (p: { candidate: RTCIceCandidateInit }) => void webrtc.handleIce(p.candidate);

    s.on("room:peer-joined", onPeerJoined);
    s.on("room:peer-left", onPeerLeft);
    s.on("room:cancelled", onCancelled);
    s.on("signal:offer", onOffer);
    s.on("signal:answer", onAnswer);
    s.on("signal:ice-candidate", onIce);

    return () => {
      s.off("room:peer-joined", onPeerJoined);
      s.off("room:peer-left", onPeerLeft);
      s.off("room:cancelled", onCancelled);
      s.off("signal:offer", onOffer);
      s.off("signal:answer", onAnswer);
      s.off("signal:ice-candidate", onIce);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = useCallback((name: string) => {
    deviceNameRef.current = name;
    setShowName(false);
    setStatus("creating");
    setError(null);
    const s = getSocket();
    if (!s.connected) s.connect();
    s.emit("room:create", { deviceName: name }, (res) => {
      if ("error" in res) {
        setError(res.error);
        setStatus("idle");
        return;
      }
      setPairingCode(res.pairingCode);
      setStatus("waiting");
    });
  }, []);

  const cancel = () => {
    getSocket().emit("room:cancel");
    webrtc.close();
    transfer.clearQueue();
    setPairingCode(null);
    setPeerName(null);
    setStatus("idle");
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
          \u2190 Home
        </Link>
        <span className="text-xs text-slate-500">Send</span>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Send files</h1>
      <p className="mt-1 text-sm text-slate-500">Create a room, then let the other device join.</p>

      {error && (
        <div className="mt-4">
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {status === "idle" && (
        <button
          type="button"
          onClick={() => setShowName(true)}
          className="mt-8 w-full rounded-2xl bg-sky-600 py-3.5 font-medium text-white hover:bg-sky-500"
        >
          Create room
        </button>
      )}

      {status === "creating" && (
        <p className="mt-8 text-center text-slate-500">Creating room\u2026</p>
      )}

      {(status === "waiting" || status === "paired" || status === "done") && pairingCode && (
        <div className="mt-6 space-y-6">
          {status === "waiting" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              <PairingCode code={pairingCode} />
              <div className="mt-6 flex justify-center">
                <QRPairing code={pairingCode} />
              </div>
              <p className="mt-4 text-center text-sm text-slate-500 animate-pulse">
                Waiting for receiver\u2026
              </p>
            </div>
          )}

          {status === "paired" && peerName && (
            <div
              className={`rounded-2xl border px-4 py-3 text-center ${
                webrtc.channelOpen
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  webrtc.channelOpen
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-amber-800 dark:text-amber-200"
                }`}
              >
                {webrtc.channelOpen
                  ? `Ready \u2014 linked to ${peerName}`
                  : `Pairing with ${peerName}\u2026`}
              </p>
            </div>
          )}

          {(status === "paired" || status === "done") && (
            <>
              <FilePicker
                onFilesSelected={transfer.addFiles}
                disabled={transfer.phase === "transferring"}
              />
              <FileQueue files={transfer.queue} onRemove={transfer.removeFile} />

              {transfer.phase === "transferring" && (
                <TransferProgress
                  bytesDone={transfer.bytesDone}
                  bytesTotal={transfer.bytesTotal}
                  speed={transfer.speed}
                  label="Sending\u2026"
                />
              )}

              {transfer.phase === "completed" || status === "done" ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                  <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                    Transfer complete
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Room closed. Nothing was stored on any server.</p>
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="mt-4 rounded-xl bg-slate-900 px-6 py-2.5 text-sm text-white dark:bg-white dark:text-slate-900"
                  >
                    Done
                  </button>
                </div>
              ) : (
                transfer.queue.some((f) => f.status === "pending") &&
                transfer.phase !== "transferring" &&
                transfer.phase !== "awaiting-accept" && (
                  <button
                    type="button"
                    onClick={() => transfer.startSend()}
                    disabled={!webrtc.channelOpen}
                    className="w-full rounded-2xl bg-emerald-600 py-3.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                  >
                    {webrtc.channelOpen ? "Send" : "Connecting\u2026"}
                  </button>
                )
              )}

              {transfer.phase === "awaiting-accept" && (
                <p className="text-center text-sm text-slate-500">Waiting for receiver to accept\u2026</p>
              )}
            </>
          )}

          {isAppleMobile() && (
            <p className="text-center text-xs text-amber-700 dark:text-amber-300/90">
              Keep this page open and keep the screen awake during large transfers.
            </p>
          )}

          {status !== "done" && (
            <button
              type="button"
              onClick={cancel}
              className="w-full rounded-xl border border-slate-300 py-2.5 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <DeviceNameDialog
        open={showName}
        onConfirm={createRoom}
        onCancel={() => setShowName(false)}
      />
    </div>
  );
}
