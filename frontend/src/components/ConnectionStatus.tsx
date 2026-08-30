import type { ConnectionState } from "../types/transfer";

const LABELS: Record<ConnectionState, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting…",
  connected: "Online",
  "in-room": "In room",
  error: "Error",
};

const COLORS: Record<ConnectionState, string> = {
  disconnected: "bg-slate-500",
  connecting: "bg-amber-400 animate-pulse",
  connected: "bg-emerald-400",
  "in-room": "bg-sky-400",
  error: "bg-red-500",
};

interface ConnectionStatusProps {
  state: ConnectionState;
  className?: string;
}

export function ConnectionStatus({ state, className = "" }: ConnectionStatusProps) {
  return (
    <div className={`inline-flex items-center gap-2 text-sm text-slate-300 ${className}`}>
      <span className={`h-2 w-2 rounded-full ${COLORS[state]}`} />
      <span>{LABELS[state]}</span>
    </div>
  );
}
