import type { QueuedFile } from "../types/transfer";
import { formatBytes, truncateName } from "../lib/formatters";
import { isImageMime } from "../lib/download";

interface FileQueueProps {
  files: QueuedFile[];
  onRemove?: (id: string) => void;
  onDownload?: (id: string) => void;
  onShare?: (id: string) => void;
}

export function FileQueue({ files, onRemove, onDownload, onShare }: FileQueueProps) {
  if (files.length === 0) return null;

  return (
    <ul className="space-y-2">
      {files.map((item) => {
        const isImage =
          item.status === "completed" &&
          !!item.blobUrl &&
          isImageMime(item.type, item.name);

        return (
          <li
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900/80"
          >
            <div className="flex items-start gap-3">
              {isImage && (
                <a
                  href={item.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                >
                  <img
                    src={item.blobUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </a>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-medium text-slate-900 dark:text-white"
                  title={item.name}
                >
                  {truncateName(item.name, 36)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatBytes(item.size)}
                  {item.status !== "pending" && ` · ${item.status}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {item.status === "pending" && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
                {item.status === "completed" && item.direction === "receive" && (
                  <div className="flex flex-wrap justify-end gap-1">
                    {onDownload && (
                      <button
                        type="button"
                        onClick={() => onDownload(item.id)}
                        className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500"
                      >
                        Download
                      </button>
                    )}
                    {isImage && onShare && (
                      <button
                        type="button"
                        onClick={() => onShare(item.id)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        title="Opens share sheet — on iPhone choose Save Image to add to Photos"
                      >
                        Save to Photos
                      </button>
                    )}
                  </div>
                )}
              </div>
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
        );
      })}
    </ul>
  );
}
