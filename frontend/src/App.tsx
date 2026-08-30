import { useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useSocket } from "./hooks/useSocket";
import { useWebRTC } from "./hooks/useWebRTC";
import { useFileTransfer } from "./hooks/useFileTransfer";
import { HomePage } from "./pages/HomePage";
import { SendPage } from "./pages/SendPage";
import { ReceivePage } from "./pages/ReceivePage";
import { TransferPage } from "./pages/TransferPage";

export default function App() {
  const webrtcRef = { current: null as ReturnType<typeof useWebRTC> | null };
  const transferRef = { current: null as ReturnType<typeof useFileTransfer> | null };

  const socket = useSocket({
    onSignalOffer: (p) => webrtcRef.current?.handleOffer(p.from, p.sdp),
    onSignalAnswer: (p) => webrtcRef.current?.handleAnswer(p.from, p.sdp),
    onSignalIce: (p) => webrtcRef.current?.handleIceCandidate(p.from, p.candidate),
    onTransferRequest: (_p) => {
      // Auto-accept for simplicity in v1; could show a confirm dialog
      // Acceptance is implicit when data channel receives file-start
    },
    onTransferAccept: () => {},
    onTransferReject: () => {},
  });

  const webrtc = useWebRTC({
    sendSignal: socket.sendSignal,
    onMessage: (from, msg) => {
      transferRef.current?.handleDataChannelMessage(from, msg);
    },
  });
  webrtcRef.current = webrtc;

  const transfer = useFileTransfer({
    sendMessage: webrtc.sendMessage,
    createOffer: webrtc.createOffer,
    sendTransferRequest: socket.sendTransferRequest,
  });
  transferRef.current = transfer;

  const handleLeave = useCallback(() => {
    webrtc.closeAll();
    socket.leaveRoom();
  }, [webrtc, socket]);

  // Merge room devices for UI (server may not set myDeviceId)
  const devices = socket.room.devices;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950">
        <header className="border-b border-slate-800/80">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
            <span className="font-semibold tracking-tight text-white">
              Local Drop
            </span>
            <span className="text-xs text-slate-500">P2P · Local network</span>
          </div>
        </header>

        <main>
          <Routes>
            <Route
              path="/"
              element={<HomePage connectionState={socket.connectionState} />}
            />
            <Route
              path="/send"
              element={
                <SendPage
                  connectionState={socket.connectionState}
                  room={socket.room}
                  error={socket.error}
                  clearError={socket.clearError}
                  createRoom={socket.createRoom}
                  leaveRoom={handleLeave}
                  queue={transfer.queue}
                  addFilesToSend={transfer.addFilesToSend}
                  removeFromQueue={transfer.removeFromQueue}
                  clearCompleted={transfer.clearCompleted}
                  startSend={transfer.startSend}
                  cancelFile={transfer.cancelFile}
                  devices={devices}
                />
              }
            />
            <Route
              path="/receive"
              element={
                <ReceivePage
                  connectionState={socket.connectionState}
                  room={socket.room}
                  error={socket.error}
                  clearError={socket.clearError}
                  joinRoom={socket.joinRoom}
                  leaveRoom={handleLeave}
                  queue={transfer.queue}
                  removeFromQueue={transfer.removeFromQueue}
                  clearCompleted={transfer.clearCompleted}
                  cancelFile={transfer.cancelFile}
                  devices={devices}
                />
              }
            />
            <Route
              path="/transfer"
              element={
                <TransferPage
                  queue={transfer.queue}
                  onCancel={transfer.cancelFile}
                  onClearCompleted={transfer.clearCompleted}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
