import { QRCodeSVG } from "qrcode.react";
import { buildJoinUrl } from "../lib/room";

interface QRPairingProps {
  code: string;
  size?: number;
}

export function QRPairing({ code, size = 200 }: QRPairingProps) {
  const value = buildJoinUrl(code);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200 dark:ring-0">
        <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
      </div>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Scan with the other device’s camera
      </p>
    </div>
  );
}
