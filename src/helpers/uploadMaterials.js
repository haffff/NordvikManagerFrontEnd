import { ActiveWebHelper as WebHelper } from "./transport";
import ProgressToastManager from "./ProgressToastManager";
import UtilityHelper from "./UtilityHelper";

/**
 * Uploads files as materials with one progress toast for the whole batch: the bar
 * follows the bytes sent, the text names the file being sent (or the last one
 * done), then success or how many failed.
 *
 * onUploaded(result, file) runs as each upload succeeds — result is the server's
 * new resource ({ id, key, ... }).
 * Resolves once every file has finished: { uploaded: result[], failed: File[] }.
 */
export function uploadMaterials(files, { onUploaded } = {}) {
  if (!files?.length) return Promise.resolve({ uploaded: [], failed: [] });

  const total = files.length;
  const single = total === 1 ? files[0].name : null;
  const opId = UtilityHelper.GenerateUUID();
  const uploaded = [];
  const failed = [];

  ProgressToastManager.start(opId, {
    title: single ? `Uploading ${single}…` : `Uploading ${total} files…`,
    total,
  });

  // Fraction sent per file; a file only counts as 1 once the server has answered.
  const sent = new Map();
  const current = () => uploaded.length + failed.length + [...sent.values()].reduce((a, b) => a + b, 0);

  const report = (file, ok) => {
    sent.delete(file);
    ProgressToastManager.update(opId, {
      current: current(),
      total,
      message: ok ? `Uploaded ${file.name}` : `Failed: ${file.name}`,
    });
  };

  // Called once per chunk sent; only updates the toast when a whole percent changes.
  const progress = (file, fraction) => {
    const percent = Math.floor(fraction * 100);
    if (Math.floor((sent.get(file) ?? 0) * 100) === percent && sent.has(file)) return;
    sent.set(file, Math.min(fraction, 0.99));
    ProgressToastManager.update(opId, {
      current: current(),
      total,
      message: `Uploading ${file.name} — ${percent}%`,
    });
  };

  const uploadOne = (file) =>
    new Promise((resolve) => {
      const fail = (err) => {
        console.error("uploadMaterials: upload failed", file.name, err);
        failed.push(file);
        report(file, false);
        resolve();
      };
      WebHelper.postMaterial(
        file,
        (result) => {
          uploaded.push(result);
          report(file, true);
          onUploaded?.(result, file);
          resolve();
        },
        fail,
        fail,
        (fraction) => progress(file, fraction)
      );
    });

  return Promise.all(files.map(uploadOne)).then(() => {
    if (failed.length === 0) {
      ProgressToastManager.complete(opId, {
        title: single ? `Uploaded ${single}` : `Uploaded ${total} files`,
      });
    } else if (failed.length === total) {
      ProgressToastManager.fail(opId, {
        title: "Upload failed",
        description: failed.map((f) => f.name).join(", "),
      });
    } else {
      ProgressToastManager.fail(opId, {
        title: `${failed.length} of ${total} uploads failed`,
        description: failed.map((f) => f.name).join(", "),
      });
    }
    return { uploaded, failed };
  });
}

export default uploadMaterials;
