import * as React from "react";
import { Button, Input } from "@chakra-ui/react";
import Subscribable from "../uiComponents/base/Subscribable";
import ClientMediator from "../../ClientMediator";
import { ActiveTransportManager } from "../../helpers/transport";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "../ui/dialog";

/**
 * RequestInputManager — always-mounted (see Game.js), not gated on isGM.
 *
 * The "Request User Input" action step sends the targeted player a `request_input`
 * WebSocket command carrying `{ message, showDialog, defaultValue }` + an `inputToken`.
 * When `showDialog` is true this shows a built-in modal so the player can answer with
 * no addon frontend; the answer goes back over the auth-free `input_value` command.
 *
 * Also registers a ClientMediator method so addons can answer programmatically:
 *   ClientMediator.sendCommandAsync("Game", "RespondToRequestInput", { inputToken, value })
 */
export const RequestInputManager = () => {
  const [current, setCurrent] = React.useState(null); // { inputToken, message, defaultValue } | null
  const [value, setValue] = React.useState("");

  const currentRef = React.useRef(null);
  const queueRef = React.useRef([]);
  const seenTokensRef = React.useRef(new Set());
  const inputRef = React.useRef(null);

  const showItem = React.useCallback((item) => {
    currentRef.current = item;
    setCurrent(item);
    setValue(item?.defaultValue ?? "");
  }, []);

  // Single response path for both the dialog and the ClientMediator method.
  const respond = React.useCallback((token, val) => {
    if (!token) {
      // Re-entrant close event after the last item was already answered — just
      // advance (queue is normally empty here).
      showItem(queueRef.current.shift() ?? null);
      return;
    }
    try {
      ActiveTransportManager.Send({ command: "input_value", inputToken: token, data: val ?? "" });
    } catch (e) {
      console.warn("[RequestInputManager] failed to send input_value", e);
    }
    if (currentRef.current?.inputToken === token) {
      showItem(queueRef.current.shift() ?? null);
    }
  }, [showItem]);

  const respondRef = React.useRef(respond);
  respondRef.current = respond;

  const onMessage = React.useCallback((resp) => {
    const d = resp?.data;
    // Only the built-in dialog opt-in; bare/other payloads are addon territory.
    if (!d || typeof d !== "object" || d.showDialog !== true || resp.inputToken == null) return;
    if (seenTokensRef.current.has(resp.inputToken)) return;
    seenTokensRef.current.add(resp.inputToken);

    const item = {
      inputToken: resp.inputToken,
      message: d.message ?? "",
      defaultValue: d.defaultValue ?? "",
    };
    if (currentRef.current) queueRef.current.push(item); // one dialog at a time
    else showItem(item);
  }, [showItem]);

  // Programmatic responder for addons — registered on the "Game" panel.
  React.useEffect(() => {
    ClientMediator.register({
      panel: "Game",
      id: "RequestInputManager",
      $meta: {
        RespondToRequestInput: {
          description:
            "Answer a pending 'request_input' from a Request User Input action step. " +
            "Provide { inputToken, value }.",
          args: [
            { name: "inputToken", type: "string", required: true },
            { name: "value", type: "string", required: true },
          ],
        },
      },
      RespondToRequestInput: ({ inputToken, value: v } = {}) => {
        if (!inputToken) return false;
        respondRef.current(inputToken, v);
        return true;
      },
    });
    return () => ClientMediator.unregister("RequestInputManager");
  }, []);

  // Focus + select the prefilled text when a dialog appears.
  React.useEffect(() => {
    if (!current) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [current]);

  return (
    <>
      <Subscribable commandPrefix="request_input" onMessage={onMessage} />
      <DialogRoot
        open={!!current}
        onOpenChange={(e) => {
          if (!e.open) respond(currentRef.current?.inputToken, ""); // Escape / X => empty answer
        }}
        closeOnInteractOutside={false} // a stray backdrop click must not discard typed text
        size="md"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{current?.message || "Input requested"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Input
              ref={inputRef}
              value={value}
              placeholder="Type your answer"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  respond(currentRef.current?.inputToken, value);
                }
              }}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              colorPalette="blue"
              variant="outline"
              onClick={() => respond(currentRef.current?.inputToken, value)}
            >
              Submit
            </Button>
            <Button variant="outline" onClick={() => respond(currentRef.current?.inputToken, "")}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

export default RequestInputManager;
