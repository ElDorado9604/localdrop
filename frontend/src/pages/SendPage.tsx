import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DeviceNameDialog } from "../components/DeviceNameDialog";
import { PairingCode } from "../components/PairingCode";
import { QRPairing } from "../components/QRPairing";
import { FilePicker } from "../components/FilePicker";
import { FileQueue } from "../components/FileQueue";
import { TransferProgress } from "../components/TransferProgress";
import { ErrorMessage } from "../components/ErrorMessage";
import { ConnectionStatus } from "../components/ConnectionStatus";
import type { ConnectionState, RoomState, DeviceInfo, QueuedFile } from "../types/transfer";

interface SendPageProps {
  connectionState: ConnectionState;
  room: RoomState;
  error: string | null;
  clearError: () => void;
  createRoom: (deviceName?: string) => Promise<{ roomId: string; code: string } | null>;
  leaveRoom: () => void;
  queue: QueuedFile[];
  addFilesToSend: (files: FileList | File[]) => void;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
  startSend: (remoteDeviceId: string) => Promise<void>;
  cancelFile: (id: string, remoteDeviceId?: string) => void;
  devices: DeviceInfo[];
}

export function SendPage({
  connectionState,
  room,
  error,
  clearError,
  createRoom,
  leaveRoom,
  queue,
  addFilesToSend,
  removeFromQueue,
  clearCompleted,
  startSend,
  cancelFile,
  devices,
}: SendPageProps) {
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreate = useCallback(async (name: string) => {
    setShowNameDialog(false);
    setCreating(true);
    const result = await createRoom(name);
    setCreating(false);
    if (result) {
      // stay on page; room is ready
    }
  }, [createRoom]);

  const otherDevices = devices.filter((d) => d.id !== room.myDeviceId);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-sm text-slate-400 hover:text-white">
          ← Home
        </Link>
        <ConnectionStatus state={connectionState} />
      </div>

      <h1 className="text-2xl font-bold text-white">Send files</h1>
      <p className="mt-1 text-sm text-slate-400">
        Create a room, let others join, then share files.
      </p>

      {error && (
        <div className="mt-4">
          <ErrorMessage message={error} onDismiss={clearError} />
        </div>
      )}

      {!room.code ? (
        <div className="mt-8">
          <button
            type="button"
            disabled={creating || connectionState === "disconnected" || connectionState === "error"}
            onClick={() => setShowNameDialog(true)}
            className="w-full rounded-xl bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {creating ? "Creating room…" : "Create room"}
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <PairingCode code={room.code} />
            <div className="mt-6 flex justify-center">
              <QRPairing code={room.code} />
            </div>
          </div>

          {otherDevices.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-slate-300">
                Connected devices
              </h2>
              <ul className="space-y-2">
                {otherDevices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
                  >
                    <span className="font-medium text-white">{d.name}</span>
                    <button
                      type="button"
                      onClick={() => startSend(d.id)}
                      disabled={queue.filter((f) => f.status === "pending").length === 0}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      Send files
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {otherDevices.length === 0 && (
            <p className="text-center text-sm text-slate-500">
              Waiting for someone to join…
            </p>
          )}

          <div>
            <h2 className="mb-3 text-sm font-medium text-slate-300">Files to send</h2>
            <FilePicker onFilesSelected={addFilesToSend} />
            <div className="mt-4">
              <FileQueue
                files={queue}
                onRemove={removeFromQueue}
                onCancel={(id) => cancelFile(id)}
                onClearCompleted={clearCompleted}
              />
            </div>
            <TransferProgress files={queue} />
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
        onConfirm={handleCreate}
        onCancel={() => setShowNameDialog(false)}
      />
    </div>
  );
}
