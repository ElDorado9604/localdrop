import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { DeviceNameDialog } from "../components/DeviceNameDialog";
import { FileQueue } from "../components/FileQueue";
import { TransferProgress } from "../components/TransferProgress";
import { ErrorMessage } from "../components/ErrorMessage";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { normalizeCode, isValidCodeFormat } from "../lib/room";
import type { ConnectionState, RoomState, QueuedFile, DeviceInfo } from "../types/transfer";

interface ReceivePageProps {
  connectionState: ConnectionState;
  room: RoomState;
  error: string | null;
  clearError: () => void;
  joinRoom: (code: string, deviceName?: string) => Promise<unknown>;
  leaveRoom: () => void;
  queue: QueuedFile[];
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
  cancelFile: (id: string) => void;
  devices: DeviceInfo[];
}

export function ReceivePage({
  connectionState,
  room,
  error,
  clearError,
  joinRoom,
  leaveRoom,
  queue,
  removeFromQueue,
  clearCompleted,
  cancelFile,
  devices,
}: ReceivePageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState("");
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Pre-fill from QR / URL
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setCodeInput(normalizeCode(code));
    }
  }, [searchParams]);

  const attemptJoin = useCallback(
    async (code: string, name?: string) => {
      setJoining(true);
      clearError();
      await joinRoom(code, name);
      setJoining(false);
      setPendingCode(null);
    },
    [joinRoom, clearError]
  );

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeCode(codeInput);
    if (!isValidCodeFormat(normalized)) {
      return;
    }
    setPendingCode(normalized);
    setShowNameDialog(true);
  };

  const handleNameConfirm = async (name: string) => {
    setShowNameDialog(false);
    if (pendingCode) {
      await attemptJoin(pendingCode, name);
    }
  };

  const inRoom = Boolean(room.code);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-sm text-slate-400 hover:text-white">
          ← Home
        </Link>
        <ConnectionStatus state={connectionState} />
      </div>

      <h1 className="text-2xl font-bold text-white">Receive files</h1>
      <p className="mt-1 text-sm text-slate-400">
        Enter the pairing code shown on the sender’s device.
      </p>

      {error && (
        <div className="mt-4">
          <ErrorMessage message={error} onDismiss={clearError} />
        </div>
      )}

      {!inRoom ? (
        <form onSubmit={handleSubmitCode} className="mt-8 space-y-4">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="ABC-123"
            maxLength={8}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-center font-mono text-2xl tracking-widest text-white placeholder-slate-600 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            autoComplete="off"
            autoCapitalize="characters"
          />
          <button
            type="submit"
            disabled={
              joining ||
              !isValidCodeFormat(codeInput) ||
              connectionState === "disconnected" ||
              connectionState === "error"
            }
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join room"}
          </button>
        </form>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-center">
            <p className="text-sm text-emerald-200">
              Connected to room <span className="font-mono font-semibold">{room.code}</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {devices.length} device{devices.length !== 1 ? "s" : ""} in room
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-slate-300">Incoming transfers</h2>
            <FileQueue
              files={queue}
              onRemove={removeFromQueue}
              onCancel={cancelFile}
              onClearCompleted={clearCompleted}
            />
            <TransferProgress files={queue} />
            {queue.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                Waiting for files…
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              leaveRoom();
              navigate("/");
            }}
            className="w-full rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Leave room
          </button>
        </div>
      )}

      <DeviceNameDialog
        open={showNameDialog}
        onConfirm={handleNameConfirm}
        onCancel={() => {
          setShowNameDialog(false);
          setPendingCode(null);
        }}
      />
    </div>
  );
}
