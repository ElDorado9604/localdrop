import { useRef, useCallback, useState } from "react";
import {
  createPeerConnection,
  createDataChannel,
  type DataChannelMessage,
  encodeMessage,
  decodeMessage,
} from "../lib/webrtc";
import type { PeerConnectionState } from "../types/transfer";

interface PeerSession {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  remoteDeviceId: string;
  isInitiator: boolean;
}

interface UseWebRTCOptions {
  sendSignal: (
    type: "offer" | "answer" | "ice-candidate",
    to: string,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  ) => void;
  onMessage?: (from: string, msg: DataChannelMessage) => void;
  onPeerStateChange?: (deviceId: string, state: PeerConnectionState) => void;
}

export function useWebRTC(options: UseWebRTCOptions) {
  const peersRef = useRef<Map<string, PeerSession>>(new Map());
  const [peerStates, setPeerStates] = useState<Record<string, PeerConnectionState>>({});
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateState = useCallback((deviceId: string, state: PeerConnectionState) => {
    setPeerStates((prev) => ({ ...prev, [deviceId]: state }));
    optionsRef.current.onPeerStateChange?.(deviceId, state);
  }, []);

  const setupChannel = useCallback((deviceId: string, channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      updateState(deviceId, "connected");
    };

    channel.onclose = () => {
      updateState(deviceId, "closed");
    };

    channel.onerror = () => {
      updateState(deviceId, "failed");
    };

    channel.onmessage = (event) => {
      const msg = decodeMessage(event.data);
      if (msg) {
        optionsRef.current.onMessage?.(deviceId, msg);
      }
    };
  }, [updateState]);

  const ensurePeer = useCallback(
    (remoteDeviceId: string, isInitiator: boolean): PeerSession => {
      let session = peersRef.current.get(remoteDeviceId);
      if (session) return session;

      const pc = createPeerConnection(
        (candidate) => {
          optionsRef.current.sendSignal("ice-candidate", remoteDeviceId, candidate.toJSON());
        },
        (state) => {
          updateState(remoteDeviceId, state as PeerConnectionState);
        }
      );

      let channel: RTCDataChannel | null = null;

      if (isInitiator) {
        channel = createDataChannel(pc);
        setupChannel(remoteDeviceId, channel);
      } else {
        pc.ondatachannel = (event) => {
          channel = event.channel;
          const s = peersRef.current.get(remoteDeviceId);
          if (s) s.channel = channel;
          setupChannel(remoteDeviceId, channel);
        };
      }

      session = { pc, channel, remoteDeviceId, isInitiator };
      peersRef.current.set(remoteDeviceId, session);
      updateState(remoteDeviceId, "connecting");
      return session;
    },
    [setupChannel, updateState]
  );

  const createOffer = useCallback(
    async (remoteDeviceId: string) => {
      const session = ensurePeer(remoteDeviceId, true);
      const offer = await session.pc.createOffer();
      await session.pc.setLocalDescription(offer);
      optionsRef.current.sendSignal("offer", remoteDeviceId, offer);
    },
    [ensurePeer]
  );

  const handleOffer = useCallback(
    async (from: string, sdp: RTCSessionDescriptionInit) => {
      const session = ensurePeer(from, false);
      await session.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await session.pc.createAnswer();
      await session.pc.setLocalDescription(answer);
      optionsRef.current.sendSignal("answer", from, answer);
    },
    [ensurePeer]
  );

  const handleAnswer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    const session = peersRef.current.get(from);
    if (!session) return;
    await session.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }, []);

  const handleIceCandidate = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
    const session = peersRef.current.get(from);
    if (!session) return;
    try {
      await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("Failed to add ICE candidate", err);
    }
  }, []);

  const sendMessage = useCallback((deviceId: string, msg: DataChannelMessage): boolean => {
    const session = peersRef.current.get(deviceId);
    if (!session?.channel || session.channel.readyState !== "open") {
      return false;
    }
    const encoded = encodeMessage(msg);
    session.channel.send(encoded as ArrayBuffer);
    return true;
  }, []);

  const closePeer = useCallback((deviceId: string) => {
    const session = peersRef.current.get(deviceId);
    if (!session) return;
    session.channel?.close();
    session.pc.close();
    peersRef.current.delete(deviceId);
    setPeerStates((prev) => {
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
  }, []);

  const closeAll = useCallback(() => {
    for (const id of [...peersRef.current.keys()]) {
      closePeer(id);
    }
  }, [closePeer]);

  const getChannel = useCallback((deviceId: string): RTCDataChannel | null => {
    return peersRef.current.get(deviceId)?.channel ?? null;
  }, []);

  return {
    peerStates,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    sendMessage,
    closePeer,
    closeAll,
    getChannel,
    ensurePeer,
  };
}
