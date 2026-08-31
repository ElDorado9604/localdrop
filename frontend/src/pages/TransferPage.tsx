/**
 * Optional dedicated transfer view — kept for compatibility; main flows use Send/Receive pages.
 */
import { Link } from "react-router-dom";
import { TransferProgress } from "../components/TransferProgress";
import { FileQueue } from "../components/FileQueue";
import type { QueuedFile } from "../types/transfer";

interface TransferPageProps {
  queue: QueuedFile[];
  bytesDone?: number;
  bytesTotal?: number;
  speed?: number;
  onRemove?: (id: string) => void;
}

export function TransferPage({
  queue,
  bytesDone = 0,
  bytesTotal = 0,
  speed = 0,
  onRemove,
}: TransferPageProps) {
  const active = queue.filter((f) => f.status === "sending" || f.status === "receiving");
  const done = queue.filter((f) => f.status === "completed");

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
        ← Home
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Transfer</h1>

      {active.length > 0 ? (
        <div className="mt-6 space-y-4">
          <TransferProgress
            bytesDone={bytesDone}
            bytesTotal={bytesTotal || active.reduce((s, f) => s + f.size, 0)}
            speed={speed}
            label="Transferring…"
          />
          <FileQueue files={active} onRemove={onRemove} />
        </div>
      ) : done.length > 0 ? (
        <div className="mt-6">
          <p className="text-emerald-600 dark:text-emerald-400">All transfers complete.</p>
          <div className="mt-4">
            <FileQueue files={done} />
          </div>
        </div>
      ) : (
        <p className="mt-8 text-center text-slate-500">No active transfers.</p>
      )}
    </div>
  );
}
