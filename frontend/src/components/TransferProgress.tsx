import type { QueuedFile } from "../types/transfer";
import { formatBytes } from "../lib/formatters";

interface TransferProgressProps {
  files: QueuedFile[];
}

export function TransferProgress({ files }: TransferProgressProps) {
  const active = files.filter(
    (f) => f.status === "sending" || f.status === "receiving"
  );

  if (active.length === 0) return null;

  const totalProgress =
    active.reduce((sum, f) => sum + f.progress, 0) / active.length;

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-950/40 px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-sky-200">
          Transferring {active.length} file{active.length > 1 ? "s" : ""}
        </span>
        <span className="text-sky-300">{Math.round(totalProgress)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-300"
          style={{ width: `${totalProgress}%` }}
        />
      </div>
      <ul className="mt-2 space-y-1">
        {active.map((f) => (
          <li key={f.id} className="flex justify-between text-xs text-slate-400">
            <span className="truncate max-w-[70%]">{f.file.name}</span>
            <span>
              {f.progress}% · {formatBytes(f.file.size)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
