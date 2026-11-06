// What moves over the game connection and how long it takes: per transfer its size, the time
// to its first byte and in all, and the heartbeat's round trip (how responsive the game is
// meanwhile). For measuring the streaming work: `nordvikTransfers()` in the browser console
// prints the summary; each finished transfer is also traced with debugLog.
import { debugLog } from './debugLog';

const MAX_TRANSFERS = 200;
const MAX_HEARTBEATS = 100;
let transfers = [];
let heartbeats = []; // { at, ms }

const mb = (bytes) => `${(bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1)} MB`;
const s = (ms) => `${(ms / 1000).toFixed(1)} s`;

const transferStats = {
  /** A request on its way: call firstByte() when its answer starts coming, done() when it's in. */
  start(method, path) {
    const at = Date.now();
    let firstByteMs = null;
    return {
      firstByte() { if (firstByteMs === null) firstByteMs = Date.now() - at; },
      done({ status, bytes }) {
        const totalMs = Date.now() - at;
        const record = { method, path, status, bytes: bytes ?? 0, firstByteMs: firstByteMs ?? totalMs, totalMs, at };
        transfers.push(record);
        if (transfers.length > MAX_TRANSFERS) transfers = transfers.slice(-MAX_TRANSFERS);
        if (record.bytes >= 262144) debugLog(`[Transfer] ${method} ${path} ${mb(record.bytes)} in ${s(totalMs)} (first byte ${s(record.firstByteMs)})`);
        return record;
      },
    };
  },

  /** The heartbeat's round trip, in ms. */
  heartbeat(ms) {
    heartbeats.push({ at: Date.now(), ms });
    if (heartbeats.length > MAX_HEARTBEATS) heartbeats = heartbeats.slice(-MAX_HEARTBEATS);
  },

  transfers: () => transfers.slice(),
  heartbeats: () => heartbeats.slice(),

  /** The 10 biggest transfers (with the slowest heartbeat while each ran) and the heartbeat overall. */
  summary() {
    const biggest = transfers.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 10).map((t) => {
      const during = heartbeats.filter((h) => h.at >= t.at && h.at <= t.at + t.totalMs).map((h) => h.ms);
      return { ...t, heartbeatMaxMs: during.length ? Math.max(...during) : null };
    });
    const times = heartbeats.map((h) => h.ms).sort((a, b) => a - b);
    return {
      biggest,
      heartbeat: { count: times.length, medianMs: times.length ? times[Math.floor((times.length - 1) / 2)] : null, maxMs: times.length ? times[times.length - 1] : null },
    };
  },

  _reset() { transfers = []; heartbeats = []; },
};

if (typeof window !== 'undefined') {
  window.nordvikTransfers = () => {
    const sum = transferStats.summary();
    console.table(sum.biggest.map((t) => ({ path: t.path, size: mb(t.bytes), firstByte: s(t.firstByteMs), total: s(t.totalMs), heartbeatMax: t.heartbeatMaxMs })));
    console.log('heartbeat', sum.heartbeat);
    return sum;
  };
}

export default transferStats;
