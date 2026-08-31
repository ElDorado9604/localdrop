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
  const [channelOpen, setChannelOpen] = useState(false);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const remoteSet = useRef(false);
  const makingOffer = useRef(false);

  const wireChannel = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";
    channelRef.current = channel;

    channel.onopen = () => {
      setChannelOpen(true);
      optionsRef.current.onChannelOpen?.(channel);
    };
    channel.onclose = () => {
      setChannelOpen(false);
      optionsRef.current.onChannelClose?.();
    };
    channel.onerror = () => {
      optionsRef.current.onConnectionFailed?.("Data channel error");
    };
    channel.onmessage = (event) => {
      optionsRef.current.onChannelMessage?.(event.data);
    };

    if (channel.readyState === "open") {
      setChannelOpen(true);
      optionsRef.current.onChannelOpen?.(channel);
    }
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
              "Could not establish a direct link. Put both devices on the same Wi\u2011Fi or hotspot and try again."
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
    if (makingOffer.current) return;
    makingOffer.current = true;
    try {
      const pc = ensurePc(true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      optionsRef.current.sendSignal("offer", offer);
    } catch (e) {
      optionsRef.current.onConnectionFailed?.(
        e instanceof Error ? e.message : "Failed to create connection offer"
      );
    } finally {
      makingOffer.current = false;
    }
  }, [ensurePc]);

  const handleOffer = useCallback(
    async (sdp: RTCSessionDescriptionInit) => {
      try {
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
      } catch (e) {
        optionsRef.current.onConnectionFailed?.(
          e instanceof Error ? e.message : "Failed to handle offer"
        );
      }
    },
    [ensurePc]
  );

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      if (pc.signalingState === "stable") return;
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
    } catch (e) {
      optionsRef.current.onConnectionFailed?.(
        e instanceof Error ? e.message : "Failed to handle answer"
      );
    }
  }, []);

  const handleIce = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (
      !candidate ||
      (!candidate.candidate && !candidate.sdpMid && candidate.sdpMLineIndex == null)
    ) {
      return;
    }
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
    makingOffer.current = false;
    setChannelOpen(false);
    setPcState("closed");
  }, []);

  return {
    pcState,
    channelOpen,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIce,
    getChannel,
    close,
  };
}
