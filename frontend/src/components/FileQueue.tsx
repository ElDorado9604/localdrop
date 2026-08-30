import type { QueuedFile } from "../types/transfer";
import { formatBytes, truncateName } from "../lib/formatters";

interface FileQueueProps {
  files: QueuedFile[];
  onRemove?: (id: string) => void;
  onCancel?: (id: string) => void;
  onClearCompleted?: () => void;
}

const STATUS_LABEL: Record<QueuedFile["status"], string> = {
  pending: "Waiting",
  sending: "Sending",
  receiving: "Receiving",
  completed: "Done",
  error: "Error",
  cancelled: "Cancelled",
};

export function FileQueue({ files, onRemove, onCancel, onClearCompleted }: FileQueueProps) {
  if (files.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">No files in queue</p>
    );
  }

  const hasCompleted = files.some((f) => f.status === "completed");

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {files.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white" title={item.file.name}>
                  {truncateName(item.file.name, 36)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatBytes(item.file.size || 0)} · {STATUS_LABEL[item.status]}
                  {item.direction === "receive" ? " ↓" : " ↑"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {(item.status === "pending" || item.status === "error") && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="text-xs text-slate-400 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
                {(item.status === "sending" || item.status === "receiving") && onCancel && (
                  <button
                    type="button"
                    onClick={() => onCancel(item.id)}
                    className="text-xs text-slate-400 hover:text-amber-400"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            {(item.status === "sending" || item.status === "receiving") && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            )}
            {item.error && (
              <p className="mt-1 text-xs text-red-400">{item.error}</p>
            )}
          </li>
        ))}
      </ul>
      {hasCompleted && onClearCompleted && (
        <button
          type="button"
          onClick={onClearCompleted}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          Clear completed
        </button>
      )}
    </div>
  );
}
