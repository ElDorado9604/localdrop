import { Link } from "react-router-dom";
import { ConnectionStatus } from "../components/ConnectionStatus";
import type { ConnectionState } from "../types/transfer";

interface HomePageProps {
  connectionState: ConnectionState;
}

export function HomePage({ connectionState }: HomePageProps) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-12">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-3xl">📦</span>
        <h1 className="text-3xl font-bold tracking-tight text-white">Local Drop</h1>
      </div>
      <p className="mb-8 text-center text-slate-400">
        Send files directly between devices on your network.
        <br />
        No cloud. No accounts.
      </p>

      <ConnectionStatus state={connectionState} className="mb-8" />

      <div className="flex w-full flex-col gap-4 sm:flex-row">
        <Link
          to="/send"
          className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-6 py-8 transition hover:border-sky-500 hover:bg-slate-800"
        >
          <span className="text-4xl">↑</span>
          <span className="font-semibold text-white">Send</span>
          <span className="text-center text-xs text-slate-400">
            Create a room & share files
          </span>
        </Link>
        <Link
          to="/receive"
          className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-6 py-8 transition hover:border-emerald-500 hover:bg-slate-800"
        >
          <span className="text-4xl">↓</span>
          <span className="font-semibold text-white">Receive</span>
          <span className="text-center text-xs text-slate-400">
            Join with code or QR
          </span>
        </Link>
      </div>

      <p className="mt-12 max-w-sm text-center text-xs text-slate-500">
        Devices pair via a short code or QR. Files transfer peer-to-peer over WebRTC —
        nothing is stored on the server.
      </p>
    </div>
  );
}
