import { useRef, useCallback, useState } from "react";
import {
  createLocalPeerConnection,
  createDataChannel,
  assertLocalCandidatePair,
} from "../lib/webrtc";

type SignalSend = (
  type: "offer" | "answer" | "ice-candidate",
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit
) => void;

interface UseWebRTCOptions {
  sendSignal: SignalSend;
  onChannelOpen?: (channel: RTCDataChannel) => void;
  onChannelMessage?: (data: ArrayBuffer | string) => void;
  onChannelClose?: () => void;
  onLocalCheckFailed?: () => void;
  onConnectionFailed?: (reason: string) => void;
}

export function useWebRTC(options: UseWebRTCOptions) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [pcState, setPcState] = useState<RTCPeerConnectionState>("new");
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const remoteSet = useRef(false);

  const wireChannel = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";
    channelRef.current = channel;

    channel.onopen = () => {
      optionsRef.current.onChannelOpen?.(channel);
    };
    channel.onclose = () => {
      optionsRef.current.onChannelClose?.();
    };
    channel.onerror = () => {
      optionsRef.current.onConnectionFailed?.("Data channel error");
    };
    channel.onmessage = (event) => {
      optionsRef.current.onChannelMessage?.(event.data);
    };
  }, []);

  const ensurePc = useCallback(
    (asInitiator: boolean): RTCPeerConnection => {
      if (pcRef.current) return pcRef.current;

      const pc = createLocalPeerConnection(
        (candidate) => {
          optionsRef.current.sendSignal("ice-candidate", candidate.toJSON());
        },
        async (state) => {
          setPcState(state);
          if (state === "connected") {
            const ok = await assertLocalCandidatePair(pc);
            if (!ok) {
              optionsRef.current.onLocalCheckFailed?.();
              pc.close();
            }
          }
          if (state === "failed") {
            optionsRef.current.onConnectionFailed?.(
              "Local connection could not be established. Confirm that both devices are connected to the same Wi-Fi network or hotspot, then try again."
            );
          }
        }
      );

      if (asInitiator) {
        const channel = createDataChannel(pc);
        wireChannel(channel);
      } else {
        pc.ondatachannel = (event) => {
          wireChannel(event.channel);
        };
      }

      pcRef.current = pc;
      return pc;
    },
    [wireChannel]
  );

  const createOffer = useCallback(async () => {
    const pc = ensurePc(true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    optionsRef.current.sendSignal("offer", offer);
  }, [ensurePc]);

  const handleOffer = useCallback(
    async (sdp: RTCSessionDescriptionInit) => {
      const pc = ensurePc(false);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      remoteSet.current = true;
      for (const c of pendingIce.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {
          /* ignore */
        }
      }
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      optionsRef.current.sendSignal("answer", answer);
    },
    [ensurePc]
  );

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    remoteSet.current = true;
    for (const c of pendingIce.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* ignore */
      }
    }
    pendingIce.current = [];
  }, []);

  const handleIce = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc || !remoteSet.current) {
      pendingIce.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      /* ignore */
    }
  }, []);

  const getChannel = useCallback(() => channelRef.current, []);

  const close = useCallback(() => {
    channelRef.current?.close();
    pcRef.current?.close();
    channelRef.current = null;
    pcRef.current = null;
    pendingIce.current = [];
    remoteSet.current = false;
    setPcState("closed");
  }, []);

  return {
    pcState,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIce,
    getChannel,
    close,
  };
}
