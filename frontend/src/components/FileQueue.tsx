import type { QueuedFile } from "../types/transfer";
import { formatBytes, truncateName } from "../lib/formatters";

interface FileQueueProps {
  files: QueuedFile[];
  onRemove?: (id: string) => void;
}

export function FileQueue({ files, onRemove }: FileQueueProps) {
  if (files.length === 0) return null;

  return (
    <ul className="space-y-2">
      {files.map((item) => (
        <li
          key={item.id}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900/80"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900 dark:text-white" title={item.name}>
                {truncateName(item.name, 36)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatBytes(item.size)}
                {item.status !== "pending" && ` · ${item.status}`}
              </p>
            </div>
            {item.status === "pending" && onRemove && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                Remove
              </button>
            )}
          </div>
          {(item.status === "sending" || item.status === "receiving") && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-200"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          )}
          {item.error && <p className="mt-1 text-xs text-red-500">{item.error}</p>}
        </li>
      ))}
    </ul>
  );
}
