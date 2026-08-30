import { formatCodeForDisplay } from "../lib/room";

interface PairingCodeProps {
  code: string;
}

export function PairingCode({ code }: PairingCodeProps) {
  const display = formatCodeForDisplay(code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.replace(/\s/g, ""));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Pairing code
      </p>
      <button
        type="button"
        onClick={copy}
        title="Copy code"
        className="mt-2 font-mono text-4xl font-bold tracking-[0.25em] text-slate-900 transition hover:text-sky-600 dark:text-white dark:hover:text-sky-300 sm:text-5xl"
      >
        {display}
      </button>
      <p className="mt-2 text-xs text-slate-500">Tap to copy</p>
    </div>
  );
}
