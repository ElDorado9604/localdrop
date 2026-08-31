/**
 * LocalDrop WebRTC helpers.
 * Signaling goes through the backend; file bytes go peer-to-peer only.
 * STUN is used only to discover candidates (no TURN / no media relay).
 */

export const CHUNK_SIZE = 64 * 1024;
export const BUFFERED_LOW_THRESHOLD = 256 * 1024;

/**
 * STUN only — helps mobile browsers get usable candidates on the same LAN.
 * No TURN: file data never relays through a third-party server.
 */
export const LOCAL_ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 2,
};

function isUsableCandidate(candidate: RTCIceCandidate): boolean {
  const s = candidate.candidate || "";
  if (candidate.type === "relay" || s.includes(" typ relay")) return false;
  return true;
}

export function createLocalPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void,
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection(LOCAL_ICE_CONFIG);

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    if (isUsableCandidate(event.candidate)) {
      onIceCandidate(event.candidate);
    }
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange(pc.connectionState);
  };

  if (onIceConnectionStateChange) {
    pc.oniceconnectionstatechange = () => {
      onIceConnectionStateChange(pc.iceConnectionState);
    };
  }

  return pc;
}

export function createDataChannel(pc: RTCPeerConnection): RTCDataChannel {
  const channel = pc.createDataChannel("localdrop", {
    ordered: true,
  });
  channel.binaryType = "arraybuffer";
  channel.bufferedAmountLowThreshold = BUFFERED_LOW_THRESHOLD;
  return channel;
}

export async function assertLocalCandidatePair(pc: RTCPeerConnection): Promise<boolean> {
  try {
    const stats = await pc.getStats();
    let selectedPairId: string | null = null;
    const pairs = new Map<string, RTCStats>();
    const locals = new Map<string, RTCStats>();
    const remotes = new Map<string, RTCStats>();

    stats.forEach((report) => {
      if (report.type === "transport") {
        const t = report as RTCStats & { selectedCandidatePairId?: string };
        if (t.selectedCandidatePairId) selectedPairId = t.selectedCandidatePairId;
      }
      if (report.type === "candidate-pair") {
        pairs.set(report.id, report);
        const p = report as RTCStats & { selected?: boolean };
        if (p.selected) selectedPairId = report.id;
      }
      if (report.type === "local-candidate") locals.set(report.id, report);
      if (report.type === "remote-candidate") remotes.set(report.id, report);
    });

    if (!selectedPairId) {
      for (const [id, report] of pairs) {
        const p = report as RTCStats & { state?: string };
        if (p.state === "succeeded") {
          selectedPairId = id;
          break;
        }
      }
    }

    if (!selectedPairId) return true;
    const pair = pairs.get(selectedPairId) as
      | (RTCStats & { localCandidateId?: string; remoteCandidateId?: string })
      | undefined;
    if (!pair?.localCandidateId || !pair?.remoteCandidateId) return true;

    const local = locals.get(pair.localCandidateId) as
      | (RTCStats & { candidateType?: string })
      | undefined;
    const remote = remotes.get(pair.remoteCandidateId) as
      | (RTCStats & { candidateType?: string })
      | undefined;
    if (!local || !remote) return true;

    if (local.candidateType === "relay" || remote.candidateType === "relay") return false;

    return true;
  } catch {
    return true;
  }
}

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

export function waitForBuffer(channel: RTCDataChannel): Promise<void> {
  if (channel.bufferedAmount <= BUFFERED_LOW_THRESHOLD) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onLow = () => {
      channel.removeEventListener("bufferedamountlow", onLow);
      resolve();
    };
    channel.addEventListener("bufferedamountlow", onLow);
  });
}

export function supportsWebRTC(): boolean {
  return typeof RTCPeerConnection !== "undefined" && typeof RTCSessionDescription !== "undefined";
}
