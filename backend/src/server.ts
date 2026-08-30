import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { RoomManager } from "./roomManager.js";
import { registerSocketHandlers } from "./socketHandlers.js";
import { startCleanupScheduler } from "./cleanup.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./types.js";

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "localdrop-signaling" });
});

app.get("/", (_req, res) => {
  res.json({
    name: "LocalDrop Signaling",
    description: "Temporary WebRTC signaling only. File bytes never touch this server.",
  });
});

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: {
      origin: CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  }
);

const roomManager = new RoomManager();
registerSocketHandlers(io, roomManager);
startCleanupScheduler(roomManager);

httpServer.listen(PORT, () => {
  console.log(`LocalDrop signaling listening on :${PORT}`);
});
