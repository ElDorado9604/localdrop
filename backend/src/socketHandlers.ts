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
    socket.data.roomId = null;
    socket.data.role = null;
    socket.data.deviceName = "";

    socket.on("room:create", (payload, callback) => {
      try {
        leaveCurrent(socket, roomManager, io);

        const name = (payload.deviceName || "Device").trim().slice(0, 32);
        const room = roomManager.createRoom(socket.id, name);
        socket.data.roomId = room.roomId;
        socket.data.role = "sender";
        socket.data.deviceName = name;
        socket.join(room.roomId);

        callback({
          roomId: room.roomId,
          pairingCode: room.pairingCode,
          expiresAt: room.expiresAt,
        });
      } catch {
        callback({ error: "Failed to create room." });
      }
    });

    socket.on("room:join", (payload, callback) => {
      try {
        leaveCurrent(socket, roomManager, io);

        const name = (payload.deviceName || "Device").trim().slice(0, 32);
        const result = roomManager.joinRoom(payload.pairingCode, socket.id, name);

        if ("error" in result) {
          callback({ error: result.error });
          return;
        }

        const { room } = result;
        socket.data.roomId = room.roomId;
        socket.data.role = "receiver";
        socket.data.deviceName = name;
        socket.join(room.roomId);

        callback({
          roomId: room.roomId,
          pairingCode: room.pairingCode,
          peerName: room.senderName,
        });

        if (room.senderSocketId) {
          io.to(room.senderSocketId).emit("room:peer-joined", {
            peerName: name,
            role: "receiver",
          });
        }
      } catch {
        callback({ error: "Failed to join room." });
      }
    });

    socket.on("room:cancel", () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      const peerId = roomManager.getPeerSocketId(socket.id);
      const by = socket.data.role === "receiver" ? "receiver" : "sender";
      roomManager.cancelRoom(room.roomId);
      if (peerId) {
        io.to(peerId).emit("room:cancelled", { by });
      }
      socket.data.roomId = null;
      socket.data.role = null;
    });

    socket.on("room:complete", () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      const peerId = roomManager.getPeerSocketId(socket.id);
      roomManager.completeRoom(room.roomId);
      if (peerId) {
        io.to(peerId).emit("transfer:completed");
      }
      socket.data.roomId = null;
      socket.data.role = null;
    });

    socket.on("transfer:started", () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (room) roomManager.setStatus(room.roomId, "transferring");
    });

    socket.on("signal:offer", (payload) => {
      relay(socket, roomManager, "signal:offer", { sdp: payload.sdp });
    });

    socket.on("signal:answer", (payload) => {
      relay(socket, roomManager, "signal:answer", { sdp: payload.sdp });
    });

    socket.on("signal:ice-candidate", (payload) => {
      relay(socket, roomManager, "signal:ice-candidate", { candidate: payload.candidate });
    });

    socket.on("disconnect", () => {
      const result = roomManager.handleDisconnect(socket.id);
      if (result?.peerSocketId) {
        io.to(result.peerSocketId).emit("room:peer-left", {
          reason: "disconnect",
        });
      }
      socket.data.roomId = null;
      socket.data.role = null;
    });
  });
}

function leaveCurrent(
  socket: AppSocket,
  roomManager: RoomManager,
  io: AppServer
): void {
  if (!socket.data.roomId) return;
  const result = roomManager.handleDisconnect(socket.id);
  if (result?.peerSocketId) {
    io.to(result.peerSocketId).emit("room:peer-left", { reason: "left" });
  }
  if (socket.data.roomId) socket.leave(socket.data.roomId);
  socket.data.roomId = null;
  socket.data.role = null;
}

function relay(
  socket: AppSocket,
  roomManager: RoomManager,
  event: "signal:offer" | "signal:answer" | "signal:ice-candidate",
  payload: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
): void {
  const peerId = roomManager.getPeerSocketId(socket.id);
  if (!peerId) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.to(peerId).emit(event as any, payload);
}
