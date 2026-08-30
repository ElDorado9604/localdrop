/** Default ICE servers — public STUN only (works well on LAN; TURN optional for hard NATs) */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const CHUNK_SIZE = 64 * 1024; // 64 KB

export type DataChannelMessage =
  | { type: "file-start"; fileId: string; name: string; size: number; mime: string }
  | { type: "file-chunk"; fileId: string; index: number; data: ArrayBuffer }
  | { type: "file-end"; fileId: string }
  | { type: "file-ack"; fileId: string; index: number }
  | { type: "cancel"; fileId: string };

export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange(pc.connectionState);
  };

  return pc;
}

export function createDataChannel(pc: RTCPeerConnection, label = "localdrop"): RTCDataChannel {
  const channel = pc.createDataChannel(label, {
    ordered: true,
  });
  channel.binaryType = "arraybuffer";
  return channel;
}

/** Split a File into ArrayBuffer chunks */
export async function* chunkFile(
  file: File,
  chunkSize = CHUNK_SIZE
): AsyncGenerator<{ index: number; data: ArrayBuffer; total: number }> {
  const total = Math.ceil(file.size / chunkSize) || 1;
  let index = 0;
  let offset = 0;

  while (offset < file.size) {
    const slice = file.slice(offset, offset + chunkSize);
    const buffer = await slice.arrayBuffer();
    yield { index, data: buffer, total };
    index++;
    offset += chunkSize;
  }
}

export function encodeMessage(msg: DataChannelMessage): string | ArrayBuffer {
  if (msg.type === "file-chunk") {
    // Binary frame: [1 byte type=1][2 bytes fileId len][fileId utf8][4 bytes index][payload]
    const idBytes = new TextEncoder().encode(msg.fileId);
    const header = new ArrayBuffer(1 + 2 + idBytes.length + 4);
    const view = new DataView(header);
    view.setUint8(0, 1); // type = chunk
    view.setUint16(1, idBytes.length);
    new Uint8Array(header, 3, idBytes.length).set(idBytes);
    view.setUint32(3 + idBytes.length, msg.index);
    const combined = new Uint8Array(header.byteLength + msg.data.byteLength);
    combined.set(new Uint8Array(header), 0);
    combined.set(new Uint8Array(msg.data), header.byteLength);
    return combined.buffer;
  }

  return JSON.stringify(msg);
}

export function decodeMessage(data: string | ArrayBuffer): DataChannelMessage | null {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as DataChannelMessage;
    } catch {
      return null;
    }
  }

  const view = new DataView(data);
  const typeByte = view.getUint8(0);
  if (typeByte !== 1) return null;

  const idLen = view.getUint16(1);
  const idBytes = new Uint8Array(data, 3, idLen);
  const fileId = new TextDecoder().decode(idBytes);
  const index = view.getUint32(3 + idLen);
  const payload = data.slice(3 + idLen + 4);

  return {
    type: "file-chunk",
    fileId,
    index,
    data: payload,
  };
}
