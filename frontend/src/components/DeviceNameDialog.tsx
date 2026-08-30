import { useState, useEffect } from "react";
import { getStoredDeviceName, setStoredDeviceName, getDefaultDeviceName } from "../lib/device";

interface DeviceNameDialogProps {
  open: boolean;
  onConfirm: (name: string) => void;
  onCancel?: () => void;
}

export function DeviceNameDialog({ open, onConfirm, onCancel }: DeviceNameDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setName(getStoredDeviceName() || getDefaultDeviceName());
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || getDefaultDeviceName();
    setStoredDeviceName(trimmed);
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Name this device</h2>
        <p className="mt-1 text-sm text-slate-400">
          Other devices will see this name when you pair.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            autoFocus
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            placeholder="e.g. My Laptop"
          />
          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
