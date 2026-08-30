# Local Drop

Peer-to-peer local file transfer over WebRTC. Share files instantly between devices on the same network — no cloud, no accounts.

## Features

- **Local-first**: Devices discover each other via a lightweight signaling server
- **WebRTC data channels**: Direct peer-to-peer file transfer
- **QR / Pairing code**: Easy device pairing
- **Multi-file queue**: Select multiple files and track progress
- **Device names**: Friendly names for connected devices

## Monorepo Structure

```
localdrop/
├── frontend/     # React + Vite + Tailwind + TypeScript
├── backend/      # Node.js + Socket.IO signaling server
├── README.md
└── .gitignore
```

## Quick Start

### Backend

```bash
cd backend
npm install
npm run dev
```

Server runs on `http://localhost:3001` by default.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5173`.

Set `VITE_SOCKET_URL` if the signaling server is not on the same origin.

## How it works

1. Devices connect to the signaling server and join a room (via pairing code or QR).
2. Signaling exchanges SDP offers/answers and ICE candidates.
3. A WebRTC data channel is established for direct file transfer.
4. Files are chunked and sent over the data channel with progress reporting.

## Tech Stack

| Layer    | Stack                                      |
|----------|--------------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS, TypeScript   |
| Backend  | Node.js, Express, Socket.IO, TypeScript    |
| P2P      | WebRTC DataChannels                        |

## License

MIT
