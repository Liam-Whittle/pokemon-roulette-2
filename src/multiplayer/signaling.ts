/** Manual WebRTC signaling: encode/decode SDP as copy-pasteable codes (no server). */

export interface SignalPayload {
  sdp: string;
  type: RTCSdpType;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encode an SDP description into a single-line code. */
export function encodeSignal(desc: RTCSessionDescriptionInit): string {
  if (!desc.sdp || !desc.type) throw new Error('Invalid session description');
  const payload: SignalPayload = { sdp: desc.sdp, type: desc.type };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  // Chunk-friendly: insert line breaks every 64 chars for easier copy.
  const b64 = bytesToBase64(bytes);
  return b64.replace(/(.{64})/g, '$1\n').trim();
}

/** Decode a paste code back into an RTCSessionDescriptionInit. */
export function decodeSignal(code: string): RTCSessionDescriptionInit {
  const cleaned = code.replace(/\s+/g, '');
  if (!cleaned) throw new Error('Empty code');
  let json: string;
  try {
    json = new TextDecoder().decode(base64ToBytes(cleaned));
  } catch {
    throw new Error('Invalid code format');
  }
  let payload: SignalPayload;
  try {
    payload = JSON.parse(json) as SignalPayload;
  } catch {
    throw new Error('Invalid code data');
  }
  if (!payload.sdp || !payload.type) throw new Error('Incomplete code');
  return { sdp: payload.sdp, type: payload.type };
}
