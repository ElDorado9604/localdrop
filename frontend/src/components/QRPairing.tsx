import { QRCodeSVG } from "qrcode.react";

interface QRPairingProps {
  code: string;
  /** Full URL that opens the join flow with this code */
  joinUrl?: string;
  size?: number;
}

export function QRPairing({ code, joinUrl, size = 180 }: QRPairingProps) {
  const value =
    joinUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/receive?code=${encodeURIComponent(code)}`
      : code);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl bg-white p-3 shadow-lg">
        <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
      </div>
      <p className="text-center text-xs text-slate-400">
        Scan with another device to join
      </p>
    </div>
  );
}
