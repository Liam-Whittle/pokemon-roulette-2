/**
 * Renders pret/pokeemerald Gen 3 SE MIDIs (se_ball_throw / se_ball_open)
 * to WAV using square + noise voices that match the Game Boy Advance SE style.
 *
 * Source MIDIs: https://github.com/pret/pokeemerald (sound/songs/midi/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOUNDS = path.resolve(__dirname, '../public/sounds');
const SAMPLE_RATE = 22050;

function readVarLen(buf, i) {
  let value = 0;
  while (i.pos < buf.length) {
    const b = buf[i.pos++];
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return value;
}

function parseMidi(buf) {
  if (buf.toString('ascii', 0, 4) !== 'MThd') throw new Error('Not MIDI');
  const format = buf.readUInt16BE(8);
  const ntrks = buf.readUInt16BE(10);
  const division = buf.readUInt16BE(12);
  let offset = 14;
  const tracks = [];

  for (let t = 0; t < ntrks; t++) {
    if (buf.toString('ascii', offset, offset + 4) !== 'MTrk') break;
    const len = buf.readUInt32BE(offset + 4);
    offset += 8;
    const end = offset + len;
    const events = [];
    let tick = 0;
    let running = 0;
    const i = { pos: offset };
    while (i.pos < end) {
      tick += readVarLen(buf, i);
      let status = buf[i.pos];
      if (status < 0x80) {
        status = running;
      } else {
        i.pos++;
        running = status;
      }
      const type = status & 0xf0;
      const channel = status & 0x0f;
      if (status === 0xff) {
        const meta = buf[i.pos++];
        const mlen = readVarLen(buf, i);
        const data = buf.subarray(i.pos, i.pos + mlen);
        i.pos += mlen;
        if (meta === 0x51 && data.length >= 3) {
          const tempo = (data[0] << 16) | (data[1] << 8) | data[2];
          events.push({ tick, type: 'tempo', tempo });
        }
      } else if (status === 0xf0 || status === 0xf7) {
        const slen = readVarLen(buf, i);
        i.pos += slen;
      } else if (type === 0x80 || type === 0x90) {
        const note = buf[i.pos++];
        const vel = buf[i.pos++];
        events.push({
          tick,
          type: type === 0x90 && vel > 0 ? 'noteOn' : 'noteOff',
          channel,
          note,
          vel,
        });
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        const a = buf[i.pos++];
        const b = buf[i.pos++];
        if (type === 0xb0) events.push({ tick, type: 'cc', channel, controller: a, value: b });
        if (type === 0xe0) {
          const bend = ((b << 7) | a) - 8192;
          events.push({ tick, type: 'bend', channel, bend });
        }
      } else if (type === 0xc0 || type === 0xd0) {
        const prog = buf[i.pos++];
        if (type === 0xc0) events.push({ tick, type: 'program', channel, program: prog });
      } else {
        break;
      }
    }
    tracks.push(events);
    offset = end;
  }
  return { format, division, tracks };
}

function midiNoteToHz(note, bend = 0) {
  const semis = note - 69 + bend / 8192 * 2;
  return 440 * 2 ** (semis / 12);
}

function renderMidiToWav(midiPath, outPath, { noiseChannels = new Set([2, 3]) } = {}) {
  const buf = fs.readFileSync(midiPath);
  const midi = parseMidi(buf);
  const events = midi.tracks.flat().sort((a, b) => a.tick - b.tick);
  let tempo = 500000;
  const tpq = midi.division || 24;

  const tickToSec = (tick, tempoUs) => (tick * tempoUs) / (tpq * 1_000_000);

  // Build timeline with current tempo map
  let curTempo = tempo;
  let lastTick = 0;
  let lastSec = 0;
  const absSec = (tick) => {
    // recompute from start for tiny files
    let sec = 0;
    let t0 = 0;
    let tmp = 500000;
    for (const e of events) {
      if (e.tick > tick) break;
      if (e.type === 'tempo') {
        sec += tickToSec(e.tick - t0, tmp);
        t0 = e.tick;
        tmp = e.tempo;
      }
    }
    sec += tickToSec(tick - t0, tmp);
    return sec;
  };

  for (const e of events) {
    if (e.type === 'tempo') curTempo = e.tempo;
  }
  const durationSec = Math.max(0.45, absSec(events[events.length - 1]?.tick ?? 0) + 0.35);
  const n = Math.ceil(durationSec * SAMPLE_RATE);
  const pcm = new Float32Array(n);

  /** @type {Map<string, {note:number, vel:number, start:number, bend:number, channel:number}>} */
  const active = new Map();
  const bends = new Map();
  const volumes = new Map();

  const keyOf = (ch, note) => `${ch}:${note}`;

  for (const e of events) {
    if (e.type === 'tempo') {
      tempo = e.tempo;
      continue;
    }
    if (e.type === 'bend') {
      bends.set(e.channel, e.bend);
      continue;
    }
    if (e.type === 'cc' && e.controller === 7) {
      volumes.set(e.channel, e.value / 127);
      continue;
    }
    if (e.type === 'noteOn') {
      active.set(keyOf(e.channel, e.note), {
        note: e.note,
        vel: e.vel,
        start: absSec(e.tick),
        bend: bends.get(e.channel) ?? 0,
        channel: e.channel,
        vol: volumes.get(e.channel) ?? 1,
      });
    } else if (e.type === 'noteOff') {
      const k = keyOf(e.channel, e.note);
      const on = active.get(k);
      if (!on) continue;
      active.delete(k);
      const start = on.start;
      const end = absSec(e.tick);
      const useNoise = noiseChannels.has(on.channel);
      const amp = (on.vel / 127) * (on.vol ?? 1) * (useNoise ? 0.28 : 0.18);
      const startI = Math.max(0, Math.floor(start * SAMPLE_RATE));
      const endI = Math.min(n, Math.ceil(end * SAMPLE_RATE));
      for (let i = startI; i < endI; i++) {
        const t = i / SAMPLE_RATE - start;
        const env = Math.min(1, t * 40) * Math.exp(-t * 6.5);
        let s;
        if (useNoise) {
          s = (Math.random() * 2 - 1) * amp * env;
        } else {
          const hz = midiNoteToHz(on.note, on.bend);
          const phase = t * hz;
          s = (phase % 1 < 0.5 ? 1 : -1) * amp * env;
        }
        pcm[i] += s;
      }
    }
  }

  // Soft peak normalize
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const norm = peak > 0 ? 0.85 / peak : 1;
  const samples = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i] * norm));
    samples.writeInt16LE((v * 32767) | 0, i * 2);
  }

  const dataSize = samples.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  fs.writeFileSync(outPath, Buffer.concat([header, samples]));
  return { durationSec, samples: n };
}

const throwMid = path.join(SOUNDS, 'se_ball_throw.mid');
const openMid = path.join(SOUNDS, 'se_ball_open.mid');
const throwWav = path.join(SOUNDS, 'battle_pokeball_throw.wav');
const openWav = path.join(SOUNDS, 'battle_pokeball_open.wav');

const thr = renderMidiToWav(throwMid, throwWav, { noiseChannels: new Set() });
const opn = renderMidiToWav(openMid, openWav, { noiseChannels: new Set([2, 3]) });
console.log('wrote', path.basename(throwWav), `${thr.durationSec.toFixed(2)}s`);
console.log('wrote', path.basename(openWav), `${opn.durationSec.toFixed(2)}s`);
