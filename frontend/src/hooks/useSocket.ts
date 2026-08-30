import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket, disconnectSocket, type AppSocket } from "../lib/socket";
import type { DeviceInfo, ConnectionState, RoomState } from "../types/transfer";
import { resolveDeviceName } from "../lib/device";
import { normalizeCode } from "../lib/room";

interface UseSocketOptions {
  onTransferRequest?: (payload: {
    from: string;
    transferId: string;
    files: { name: string; size: number; type: string }[];
  }) => void;
  onSignalOffer?: (payload: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  onSignalAnswer?: (payload: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  onSignalIce?: (payload: { from: string; candidate: RTCIceCandidateInit }) => void;
  onTransferAccept?: (payload: { from: string; transferId: string }) => void;
  onTransferReject?: (payload: { from: string; transferId: string; reason?: string }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [room, setRoom] = useState<RoomState>({
    roomId: null,
    code: null,
    devices: [],
    myDeviceId: null,
  });
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<AppSocket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => setConnectionState("connected");
    const onDisconnect = () => {
      setConnectionState("disconnected");
      setRoom({ roomId: null, code: null, devices: [], myDeviceId: null });
    };
    const onConnectError = () => {
      setConnectionState("error");
      setError("Could not reach signaling server");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    socket.on("room:device-joined", (device: DeviceInfo) => {
      setRoom((prev) => ({
        ...prev,
        devices: prev.devices.some((d) => d.id === device.id)
          ? prev.devices
          : [...prev.devices, device],
      }));
    });

    socket.on("room:device-left", ({ deviceId }) => {
      setRoom((prev) => ({
        ...prev,
        devices: prev.devices.filter((d) => d.id !== deviceId),
      }));
    });

    socket.on("signal:offer", (p) => optionsRef.current.onSignalOffer?.(p));
    socket.on("signal:answer", (p) => optionsRef.current.onSignalAnswer?.(p));
    socket.on("signal:ice-candidate", (p) => optionsRef.current.onSignalIce?.(p));
    socket.on("transfer:request", (p) => optionsRef.current.onTransferRequest?.(p));
    socket.on("transfer:accept", (p) => optionsRef.current.onTransferAccept?.(p));
    socket.on("transfer:reject", (p) => optionsRef.current.onTransferReject?.(p));

    if (!socket.connected) {
      setConnectionState("connecting");
      socket.connect();
    } else {
      setConnectionState("connected");
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("room:device-joined");
      socket.off("room:device-left");
      socket.off("signal:offer");
      socket.off("signal:answer");
      socket.off("signal:ice-candidate");
      socket.off("transfer:request");
      socket.off("transfer:accept");
      socket.off("transfer:reject");
    };
  }, []);

  const createRoom = useCallback(async (deviceName?: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError("Not connected to server");
      return null;
    }
    setError(null);
    const name = deviceName || resolveDeviceName();

    return new Promise<{ roomId: string; code: string } | null>((resolve) => {
      socket.emit("room:create", { deviceName: name }, (res) => {
        if ("error" in res) {
          setError(res.error);
          resolve(null);
          return;
        }
        setRoom({
          roomId: res.roomId,
          code: res.code,
          devices: [],
          myDeviceId: null,
        });
        setConnectionState("in-room");
        resolve(res);
      });
    });
  }, []);

  const joinRoom = useCallback(async (code: string, deviceName?: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError("Not connected to server");
      return null;
    }
    setError(null);
    const normalized = normalizeCode(code);
    const name = deviceName || resolveDeviceName();

    return new Promise<{ roomId: string; code: string; devices: DeviceInfo[] } | null>((resolve) => {
      socket.emit("room:join", { code: normalized, deviceName: name }, (res) => {
        if ("error" in res) {
          setError(res.error);
          resolve(null);
          return;
        }
        setRoom({
          roomId: res.roomId,
          code: res.code,
          devices: res.devices,
          myDeviceId: null,
        });
        setConnectionState("in-room");
        resolve(res);
      });
    });
  }, []);

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("room:leave");
    }
    setRoom({ roomId: null, code: null, devices: [], myDeviceId: null });
    setConnectionState(socket?.connected ? "connected" : "disconnected");
  }, []);

  const sendSignal = useCallback(
    (
      type: "offer" | "answer" | "ice-candidate",
      to: string,
      payload: RTCSessionDescriptionInit | RTCIceCandidateInit
    ) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      if (type === "offer") {
        socket.emit("signal:offer", { to, sdp: payload as RTCSessionDescriptionInit });
      } else if (type === "answer") {
        socket.emit("signal:answer", { to, sdp: payload as RTCSessionDescriptionInit });
      } else {
        socket.emit("signal:ice-candidate", {
          to,
          candidate: payload as RTCIceCandidateInit,
        });
      }
    },
    []
  );

  const sendTransferRequest = useCallback(
    (to: string, transferId: string, files: { name: string; size: number; type: string }[]) => {
      socketRef.current?.emit("transfer:request", { to, transferId, files });
    },
    []
  );

  const sendTransferAccept = useCallback((to: string, transferId: string) => {
    socketRef.current?.emit("transfer:accept", { to, transferId });
  }, []);

  const sendTransferReject = useCallback((to: string, transferId: string, reason?: string) => {
    socketRef.current?.emit("transfer:reject", { to, transferId, reason });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    connectionState,
    room,
    error,
    clearError,
    createRoom,
    joinRoom,
    leaveRoom,
    sendSignal,
    sendTransferRequest,
    sendTransferAccept,
    sendTransferReject,
    socket: socketRef,
  };
}

export { disconnectSocket };
