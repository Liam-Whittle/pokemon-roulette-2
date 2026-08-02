/**
 * Sum frame delays from GIF bytes (Graphic Control Extension).
 * Delay units are hundredths of a second; browsers treat 0 as ~10ms.
 */
export function parseGifDurationMs(bytes: Uint8Array): number | null {
  if (bytes.length < 13) return null;
  const header = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!, bytes[4]!, bytes[5]!);
  if (header !== 'GIF87a' && header !== 'GIF89a') return null;

  const screenPacked = bytes[10]!;
  let i = 13;
  if (screenPacked & 0x80) {
    i += 3 * (2 << (screenPacked & 0x07));
  }

  let totalCs = 0;
  let frames = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b === 0x3b) break; // trailer
    if (b === 0x21) {
      const label = bytes[i + 1];
      if (label === 0xf9 && bytes[i + 2] === 4) {
        const delayCs = bytes[i + 4]! | (bytes[i + 5]! << 8);
        totalCs += delayCs === 0 ? 10 : delayCs;
        frames += 1;
        i += 8;
        continue;
      }
      i += 2;
      while (i < bytes.length) {
        const sz = bytes[i]!;
        i += 1;
        if (sz === 0) break;
        i += sz;
      }
      continue;
    }
    if (b === 0x2c) {
      if (i + 10 >= bytes.length) break;
      const localPacked = bytes[i + 9]!;
      i += 10;
      if (localPacked & 0x80) {
        i += 3 * (2 << (localPacked & 0x07));
      }
      i += 1; // LZW min code size
      while (i < bytes.length) {
        const sz = bytes[i]!;
        i += 1;
        if (sz === 0) break;
        i += sz;
      }
      continue;
    }
    i += 1;
  }

  if (frames === 0) return null;
  return totalCs * 10;
}

/** Fetch a GIF and return its total animation duration in ms. */
export async function getGifDurationMs(url: string): Promise<number | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseGifDurationMs(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}
