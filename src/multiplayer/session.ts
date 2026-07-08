import { decodeSignal, encodeSignal } from './signaling';
import { isMpMessage, type MpMessage } from './protocol';

export type SessionStatus =
  | 'idle'
  | 'creating-offer'
  | 'waiting-answer'
  | 'creating-answer'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

type StatusListener = (status: SessionStatus, error?: string) => void;
type MessageListener = (message: MpMessage) => void;

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    // Fallback if gathering never completes (some browsers).
    window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, 2500);
  });
}

/**
 * Browser-only WebRTC data-channel session with manual SDP exchange.
 * No STUN/TURN by default (LAN / simple networks).
 */
export class MpSession {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private status: SessionStatus = 'idle';
  private statusListeners = new Set<StatusListener>();
  private messageListeners = new Set<MessageListener>();
  private role: 'host' | 'guest' | null = null;

  getStatus(): SessionStatus {
    return this.status;
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  private setStatus(status: SessionStatus, error?: string) {
    this.status = status;
    for (const listener of this.statusListeners) listener(status, error);
  }

  private createPeer(): RTCPeerConnection {
    // Empty iceServers = host candidates only (no external STUN service).
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') this.setStatus('connected');
      else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        if (this.status === 'connected' || this.status === 'connecting') {
          this.setStatus('disconnected');
        }
      }
    };
    return pc;
  }

  private wireChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => this.setStatus('connected');
    channel.onclose = () => {
      if (this.status !== 'idle') this.setStatus('disconnected');
    };
    channel.onerror = () => this.setStatus('error', 'Data channel error');
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as unknown;
        if (!isMpMessage(data)) return;
        for (const listener of this.messageListeners) listener(data);
      } catch {
        // ignore malformed
      }
    };
  }

  /** Host: create offer code for the guest to paste. */
  async createHostOffer(): Promise<string> {
    this.close();
    this.role = 'host';
    this.setStatus('creating-offer');
    const pc = this.createPeer();
    this.pc = pc;

    const channel = pc.createDataChannel('pokespin', { ordered: true });
    this.wireChannel(channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    const local = pc.localDescription;
    if (!local) throw new Error('Failed to create offer');
    this.setStatus('waiting-answer');
    return encodeSignal(local);
  }

  /** Host: apply guest's answer code. */
  async acceptGuestAnswer(answerCode: string): Promise<void> {
    if (!this.pc || this.role !== 'host') throw new Error('No host session');
    this.setStatus('connecting');
    const answer = decodeSignal(answerCode);
    await this.pc.setRemoteDescription(answer);
  }

  /** Guest: paste host offer, return answer code to send back. */
  async createGuestAnswer(offerCode: string): Promise<string> {
    this.close();
    this.role = 'guest';
    this.setStatus('creating-answer');
    const pc = this.createPeer();
    this.pc = pc;

    pc.ondatachannel = (event) => {
      this.wireChannel(event.channel);
    };

    const offer = decodeSignal(offerCode);
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc);

    const local = pc.localDescription;
    if (!local) throw new Error('Failed to create answer');
    this.setStatus('connecting');
    return encodeSignal(local);
  }

  send(message: MpMessage): boolean {
    if (!this.channel || this.channel.readyState !== 'open') return false;
    this.channel.send(JSON.stringify(message));
    return true;
  }

  close() {
    try {
      this.channel?.close();
    } catch {
      /* ignore */
    }
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.channel = null;
    this.pc = null;
    this.role = null;
    this.setStatus('idle');
  }
}

/** Shared singleton session for the app. */
export const mpSession = new MpSession();
