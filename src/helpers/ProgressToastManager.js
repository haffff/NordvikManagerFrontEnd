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
const ProgressToastManager = {
  start(id, { title, description, total } = {}) {
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
};

ClientMediator.on('Progress:Start', (data) => ProgressToastManager.start(data?.id, data));
ClientMediator.on('Progress:Update', (data) => ProgressToastManager.update(data?.id, data));
ClientMediator.on('Progress:Complete', (data) => ProgressToastManager.complete(data?.id, data));
ClientMediator.on('Progress:Failed', (data) => ProgressToastManager.fail(data?.id, data));

export default ProgressToastManager;
