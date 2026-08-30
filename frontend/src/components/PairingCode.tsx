import { formatCodeForDisplay } from "../lib/room";

interface PairingCodeProps {
  code: string;
  className?: string;
}

export function PairingCode({ code, className = "" }: PairingCodeProps) {
  const display = formatCodeForDisplay(code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`text-center ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        Pairing code
      </p>
      <button
        type="button"
        onClick={copy}
        title="Click to copy"
        className="mt-2 font-mono text-3xl font-bold tracking-[0.2em] text-white transition hover:text-sky-300 sm:text-4xl"
      >
        {display}
      </button>
      <p className="mt-2 text-xs text-slate-500">Tap to copy</p>
    </div>
  );
}
