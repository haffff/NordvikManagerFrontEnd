import * as React from "react";
import { Button, ButtonGroup, Dialog, Link, Text } from "@chakra-ui/react";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";
import WebHelper from "../../helpers/WebHelper";

const DISMISSED_KEY = "nm_updateNoticeDismissed";

const dismissedVersion = () => {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch (e) {
    return null;
  }
};

const rememberDismissed = (version) => {
  try {
    sessionStorage.setItem(DISMISSED_KEY, version);
  } catch (e) {
    // private mode: the notice may come back on the next visit
  }
};

/**
 * Lobby notice for the local admin: a newer server is available (from the server's own check,
 * see Application Settings → Server → Updates). Shown once per browser session and version,
 * never when the admin turned update notices off.
 */
export const UpdateNoticeDialog = ({ enabled, onOpenSettings }) => {
  const [status, setStatus] = React.useState(null);

  React.useEffect(() => {
    if (!enabled) return;
    (async () => {
      const result = await WebHelper.getAsync("update");
      if (result?.available && !result.noticesOff && dismissedVersion() !== result.available.version) setStatus(result);
    })();
  }, [enabled]);

  if (!status) return null;
  const { available } = status;

  const close = () => {
    rememberDismissed(available.version);
    setStatus(null);
  };

  const noMoreNotices = async () => {
    await WebHelper.putAsync("update/settings", {
      channel: status.channel === "Dev" ? "dev" : "stable",
      noticesOff: true,
    });
    close();
  };

  return (
    <DialogRoot lazyMount open onOpenChange={(e) => !e.open && close()}>
      <DialogBackdrop />
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>
          <Dialog.Title>Update available</Dialog.Title>
        </DialogHeader>
        <DialogBody>
          <Text>
            <b>NordvikManager {available.version} is available</b>
            {available.prerelease ? " (dev build)" : ""}. This server runs {status.currentVersion}.{" "}
            <Link href={available.releasePage} target="_blank" rel="noreferrer" colorPalette="blue">
              What's new
            </Link>
          </Text>
          <Text fontSize="sm" color="fg.muted" mt={2}>
            Installing backs up your data first and restarts the server.
          </Text>
        </DialogBody>
        <Dialog.Footer>
          <ButtonGroup>
            <Button variant="ghost" onClick={noMoreNotices}>
              Don't show update notices
            </Button>
            <Button variant="outline" onClick={close}>
              Later
            </Button>
            <Button
              onClick={() => {
                close();
                onOpenSettings();
              }}
            >
              Install…
            </Button>
          </ButtonGroup>
        </Dialog.Footer>
      </DialogContent>
    </DialogRoot>
  );
};

export default UpdateNoticeDialog;
