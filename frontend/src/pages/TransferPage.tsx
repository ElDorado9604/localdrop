/**
 * Optional dedicated transfer view — can be used when a transfer is in progress
 * and you want a focused full-screen progress UI.
 */
import { Link } from "react-router-dom";
import { TransferProgress } from "../components/TransferProgress";
import { FileQueue } from "../components/FileQueue";
import type { QueuedFile } from "../types/transfer";

interface TransferPageProps {
  queue: QueuedFile[];
  onCancel?: (id: string) => void;
  onClearCompleted?: () => void;
}

export function TransferPage({ queue, onCancel, onClearCompleted }: TransferPageProps) {
  const active = queue.filter(
    (f) => f.status === "sending" || f.status === "receiving"
  );
  const done = queue.filter((f) => f.status === "completed");

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link to="/" className="text-sm text-slate-400 hover:text-white">
        ← Home
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-white">Transfer</h1>

      {active.length > 0 ? (
        <div className="mt-6">
          <TransferProgress files={queue} />
          <div className="mt-4">
            <FileQueue files={active} onCancel={onCancel} />
          </div>
        </div>
      ) : done.length > 0 ? (
        <div className="mt-6">
          <p className="text-emerald-400">All transfers complete.</p>
          <div className="mt-4">
            <FileQueue files={done} onClearCompleted={onClearCompleted} />
          </div>
        </div>
      ) : (
        <p className="mt-8 text-center text-slate-500">No active transfers.</p>
      )}
    </div>
  );
}
