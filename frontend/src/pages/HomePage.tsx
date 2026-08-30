import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col items-center justify-center px-4 py-10">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-xl text-white">
          ↓↑
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          LocalDrop
        </h1>
      </div>
      <p className="mb-8 text-center text-slate-500 dark:text-slate-400">
        Send files directly on the same Wi‑Fi or hotspot.
      </p>

      <div className="flex w-full flex-col gap-3">
        <Link
          to="/send"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-2xl text-white">
            ↑
          </span>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Send files</p>
            <p className="text-sm text-slate-500">Create a room and share</p>
          </div>
        </Link>
        <Link
          to="/receive"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-2xl text-white">
            ↓
          </span>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Receive files</p>
            <p className="text-sm text-slate-500">Scan QR or enter a code</p>
          </div>
        </Link>
      </div>

      <div className="mt-10 space-y-3 text-center text-xs leading-relaxed text-slate-500">
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-200/90">
          Both devices must be connected to the same Wi‑Fi network or personal hotspot.
        </p>
        <p>
          Files transfer directly between devices. No account, cloud storage, or transfer history.
        </p>
      </div>
    </div>
  );
}
