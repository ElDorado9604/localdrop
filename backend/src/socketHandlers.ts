import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./types.js";
import { RoomManager } from "./roomManager.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerSocketHandlers(io: AppServer, roomManager: RoomManager): void {
  io.on("connection", (socket: AppSocket) => {
    socket.on("room:create", (payload, callback) => {
      try {
        const { roomId, code, device } = roomManager.createRoom(
          socket.id,
          payload.deviceName?.trim() || "Anonymous"
        );
        socket.data.deviceId = device.id;
        socket.data.roomId = roomId;
        socket.data.deviceName = device.name;
        socket.join(roomId);

        callback({ roomId, code });
        // Creator is the only device; no need to emit device-joined to others
      } catch (err) {
        console.error("room:create error", err);
        callback({ error: "Failed to create room." });
      }
    });

    socket.on("room:join", (payload, callback) => {
      try {
        const result = roomManager.joinRoom(
          payload.code,
          socket.id,
          payload.deviceName?.trim() || "Anonymous"
        );

        if ("error" in result) {
          callback({ error: result.error });
          return;
        }

        const { roomId, code, device, devices } = result;
        socket.data.deviceId = device.id;
        socket.data.roomId = roomId;
        socket.data.deviceName = device.name;
        socket.join(roomId);

        callback({ roomId, code, devices });

        // Notify other devices in the room
        socket.to(roomId).emit("room:device-joined", device);
      } catch (err) {
        console.error("room:join error", err);
        callback({ error: "Failed to join room." });
      }
    });

    socket.on("room:leave", () => {
      handleLeave(socket, roomManager);
    });

    // WebRTC signaling relay
    socket.on("signal:offer", (payload) => {
      relayToDevice(socket, roomManager, payload.to, "signal:offer", {
        from: socket.data.deviceId,
        sdp: payload.sdp,
      });
    });

    socket.on("signal:answer", (payload) => {
      relayToDevice(socket, roomManager, payload.to, "signal:answer", {
        from: socket.data.deviceId,
        sdp: payload.sdp,
      });
    });

    socket.on("signal:ice-candidate", (payload) => {
      relayToDevice(socket, roomManager, payload.to, "signal:ice-candidate", {
        from: socket.data.deviceId,
        candidate: payload.candidate,
      });
    });

    // Transfer signaling (metadata only; actual bytes go over WebRTC)
    socket.on("transfer:request", (payload) => {
      relayToDevice(socket, roomManager, payload.to, "transfer:request", {
        from: socket.data.deviceId,
        transferId: payload.transferId,
        files: payload.files,
      });
    });

    socket.on("transfer:accept", (payload) => {
      relayToDevice(socket, roomManager, payload.to, "transfer:accept", {
        from: socket.data.deviceId,
        transferId: payload.transferId,
      });
    });

    socket.on("transfer:reject", (payload) => {
      relayToDevice(socket, roomManager, payload.to, "transfer:reject", {
        from: socket.data.deviceId,
        transferId: payload.transferId,
        reason: payload.reason,
      });
    });

    socket.on("disconnect", () => {
      handleLeave(socket, roomManager);
    });
  });
}

function handleLeave(socket: AppSocket, roomManager: RoomManager): void {
  const result = roomManager.leaveRoom(socket.id);
  if (!result) return;

  const { roomId, deviceId } = result;
  socket.leave(roomId);
  socket.data.roomId = null;

  if (result.remaining.length > 0) {
    socket.to(roomId).emit("room:device-left", { deviceId });
  }
}

function relayToDevice(
  socket: AppSocket,
  roomManager: RoomManager,
  targetDeviceId: string,
  event: keyof ServerToClientEvents,
  payload: unknown
): void {
  const roomId = socket.data.roomId;
  if (!roomId || !socket.data.deviceId) return;

  const targetSocketId = roomManager.getSocketIdForDevice(roomId, targetDeviceId);
  if (!targetSocketId) return;

  roomManager.touch(roomId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.to(targetSocketId).emit(event as any, payload);
}
