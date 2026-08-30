# LocalDrop

**Send files directly on the same Wi‑Fi or hotspot.**

Peer-to-peer local file transfer over WebRTC. No accounts, no cloud, no transfer history. File bytes never touch the server.

## Features

- Local-only WebRTC (`iceServers: []` — host candidates only, no STUN/TURN)
- QR code + 6-digit pairing code
- Multi-file queue with progress, speed, and ETA
- Mobile-first PWA (installable)
- Dark mode by default, optional light mode
- Temporary in-memory rooms (auto-expire after 5 minutes if unused)

## Architecture

| Layer    | Stack                                      | Hosting   |
|----------|--------------------------------------------|-----------|
| Frontend | React 18, Vite, Tailwind, TypeScript, PWA  | Vercel    |
| Backend  | Node.js, Express, Socket.IO, TypeScript    | Render    |
| Transfer | WebRTC RTCDataChannel (chunked, backpressure) | Device-to-device |

The backend is **signaling only**. It never receives, stores, or proxies file bytes.

## Quick start

### Backend (signaling)

```bash
cd backend
npm install
npm run dev
```

Listens on `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens `http://localhost:5173`. Vite proxies Socket.IO to the backend.

Set `VITE_SOCKET_URL` to your Render signaling URL in production.

## How it works

1. Sender creates a temporary room → gets a 6-digit code + QR.
2. Receiver joins via QR or code (same Wi‑Fi / hotspot required).
3. WebRTC negotiates a **local host-to-host** data channel.
4. Files are chunked (64 KB) with backpressure and sent peer-to-peer.
5. Room is destroyed on complete, cancel, disconnect, or expiry.

## Supported scenarios

- Same home/office Wi‑Fi (phone ↔ laptop, etc.)
- Personal hotspot (iPhone/Android hotspot → other devices)
- ChromeOS, Windows, macOS, iOS Safari, Android Chrome

## Deploy

- **Frontend (Vercel):** connect the `frontend` directory; set `VITE_SOCKET_URL`.
- **Backend (Render):** Docker web service from `backend/Dockerfile`; set `CORS_ORIGIN` to your Vercel URL.

## License

MIT
