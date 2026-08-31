import { formatBytes, formatSpeed, formatEta } from "../lib/formatters";

interface TransferProgressProps {
  bytesDone: number;
  bytesTotal: number;
  speed: number;
  label?: string;
}

export function TransferProgress({ bytesDone, bytesTotal, speed, label }: TransferProgressProps) {
  const pct = bytesTotal > 0 ? Math.min(100, Math.round((bytesDone / bytesTotal) * 100)) : 0;
  const remaining = speed > 0 ? (bytesTotal - bytesDone) / speed : -1;

  return (
    <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-4">
      {label && <p className="mb-2 text-sm font-medium text-sky-800 dark:text-sky-200">{label}</p>}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-300">
          {formatBytes(bytesDone)} / {formatBytes(bytesTotal)}
        </span>
        <span className="font-semibold text-sky-700 dark:text-sky-300">{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{formatSpeed(speed)}</span>
        <span>~{formatEta(remaining)} left</span>
      </div>
    </div>
  );
}
