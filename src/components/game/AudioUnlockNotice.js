import * as React from "react";
import { onWaitingChange, waitingCount } from "../../helpers/audioUnlock";

// Shown while music waits for the browser's autoplay policy (see helpers/audioUnlock.js).
// Any click or key press starts it, this notice included.
const AudioUnlockNotice = () => {
  const count = React.useSyncExternalStore(onWaitingChange, waitingCount);
  if (count === 0) return null;
  return (
    <div className="nm_audioUnlockNotice" role="status">
      Click anywhere to enable sound
    </div>
  );
};

export default AudioUnlockNotice;
