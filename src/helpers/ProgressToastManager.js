import { toaster } from '../components/ui/toaster';
import ClientMediator from '../ClientMediator';

/**
 * Generic "operation progress" toast, built on top of the existing Chakra toaster.
 * Anyone can drive it purely through ClientMediator events — no import of this module,
 * the toaster, or WebSocket internals required:
 *
 *   ClientMediator.fireEvent("Progress:Start",    { id, title, description, total })
 *   ClientMediator.fireEvent("Progress:Update",   { id, current, total, message })
 *   ClientMediator.fireEvent("Progress:Complete", { id, title, description })
 *   ClientMediator.fireEvent("Progress:Failed",   { id, title, description })
 *
 * `total` omitted means "indeterminate count" — renders a spinner + running counter
 * instead of a percentage bar (used by LinkDirectory, which never knows the total
 * file count upfront).
 */
// A server operation runs in the background before the request that returns its id
// is answered, so a fast one can complete (or fail) before the caller knows the id
// and calls start(). Outcomes are remembered for a while, so a late start() doesn't
// open a spinner nothing will ever close, and track() can settle straight away.
const FINISHED_KEEP_MS = 5 * 60 * 1000;
const finished = new Map(); // id → { failed, data }

const remember = (id, failed, data) => {
  if (id == null) return;
  finished.set(id, { failed, data });
  setTimeout(() => finished.delete(id), FINISHED_KEEP_MS);
};

const ProgressToastManager = {
  start(id, { title, description, total } = {}) {
    if (finished.has(id)) return; // already over; its outcome toast is showing
    toaster.create({
      id,
      title,
      description,
      type: 'loading',
      duration: Infinity,
      meta: { progress: { current: 0, total } },
    });
  },

  update(id, { current, total, message } = {}) {
    if (finished.has(id)) return;
    if (!toaster.isVisible(id)) {
      // Out-of-order safety: an update arrived before/without a start.
      this.start(id, { title: message, total });
      return;
    }
    toaster.update(id, {
      ...(message !== undefined ? { description: message } : {}),
      meta: { progress: { current, total } },
    });
  },

  complete(id, { title, description, duration = 4000 } = {}) {
    remember(id, false, { id, title, description });
    if (!toaster.isVisible(id)) {
      toaster.create({ id, title, description, type: 'success', duration });
      return;
    }
    toaster.update(id, {
      title,
      description,
      type: 'success',
      duration,
      meta: { progress: undefined },
    });
  },

  fail(id, { title, description, duration = 6000 } = {}) {
    remember(id, true, { id, title, description });
    if (!toaster.isVisible(id)) {
      toaster.create({ id, title, description, type: 'error', duration });
      return;
    }
    toaster.update(id, {
      title,
      description,
      type: 'error',
      duration,
      meta: { progress: undefined },
    });
  },

  /**
   * Shows progress for a server operation whose id the caller just got back, and
   * resolves with the Progress:Complete data (rejects on Progress:Failed), including
   * when the operation already finished before this call.
   */
  track(id, startOptions = {}, timeout = 10 * 60 * 1000) {
    const settle = ({ failed, data }) => {
      if (failed) throw new Error(data?.description || data?.title || 'Operation failed');
      return data;
    };
    if (finished.has(id)) return Promise.resolve(finished.get(id)).then(settle);

    const outcome = new Promise((resolve, reject) => {
      const done = (failed) => (data) => {
        if (data?.id !== id) return;
        ClientMediator.off(onComplete);
        ClientMediator.off(onFailed);
        clearTimeout(timer);
        resolve({ failed, data });
      };
      const onComplete = ClientMediator.on('Progress:Complete', done(false));
      const onFailed = ClientMediator.on('Progress:Failed', done(true));
      const timer = setTimeout(() => {
        ClientMediator.off(onComplete);
        ClientMediator.off(onFailed);
        reject(new Error('Operation timed out'));
      }, timeout);
    });
    this.start(id, startOptions);
    return outcome.then(settle);
  },
};

ClientMediator.on('Progress:Start', (data) => ProgressToastManager.start(data?.id, data));
ClientMediator.on('Progress:Update', (data) => ProgressToastManager.update(data?.id, data));
ClientMediator.on('Progress:Complete', (data) => ProgressToastManager.complete(data?.id, data));
ClientMediator.on('Progress:Failed', (data) => ProgressToastManager.fail(data?.id, data));

export default ProgressToastManager;
