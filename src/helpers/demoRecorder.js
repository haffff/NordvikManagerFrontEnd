// Records a game session's data-channel traffic, to build the public demo's
// fixtures from (src/demo/fixtures.js, scripts/demo/build-fixtures.mjs).
//
// Off unless you turn it on in the browser console, in a dedicated demo game:
//   localStorage.nm_record_demo = "1"   then reload and click through the game
//   nmDemoRecorder.download()           saves the recording as JSON
//   localStorage.removeItem("nm_record_demo")   when done

export const RECORD_STORAGE_KEY = 'nm_record_demo';

const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const saveFile = (fileName, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function createDemoRecorder({ storage = browserStorage(), now = () => Date.now() } = {}) {
  let enabled = false;
  try {
    enabled = storage?.getItem(RECORD_STORAGE_KEY) === '1';
  } catch {
    enabled = false;
  }

  return {
    enabled,
    entries: [],
    /** dir: 'out' (sent to the GM backend) or 'in' (received). */
    record(dir, msg) {
      if (!this.enabled) return;
      this.entries.push({ t: now(), dir, msg: JSON.parse(JSON.stringify(msg)) });
    },
    download(save = saveFile) {
      const stamp = new Date(now()).toISOString().replace(/[:.]/g, '-');
      save(`nordvik-demo-recording-${stamp}.json`, JSON.stringify({ version: 1, entries: this.entries }));
    },
    clear() {
      this.entries = [];
    },
  };
}

export const demoRecorder = createDemoRecorder();

if (demoRecorder.enabled && typeof window !== 'undefined') {
  window.nmDemoRecorder = demoRecorder;
  console.info('[Demo recorder] Recording this session. Run nmDemoRecorder.download() to save it.');
}
