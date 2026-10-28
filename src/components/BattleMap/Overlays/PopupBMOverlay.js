import { useEffect, useRef, useState } from "react";
import ClientMediator from "../../../ClientMediator";

export const PopupBMOverlay = ({ battleMapId, canvas }) => {
  const [show, setShow] = useState(false);
  const [content, setPopupContent] = useState(undefined);
  const popupRef = useRef(undefined);

  useEffect(() => {
    if (!battleMapId) {
      console.warn('PopupBMOverlay: no battleMapId provided, skipping registration');
      return;
    }

    const regId = "BattleMap_Popup_" + battleMapId;
    ClientMediator.unregister(regId); // ensure clean state
    ClientMediator.register({
      panel: "BattleMap",
      id: regId,
      contextId: battleMapId,
      ShowPopup: ({ content }) => {
        setPopupContent(content);
        setShow(true);
      },
      HidePopup: () => {
        setPopupContent(undefined);
        setShow(false);
      },
    });

    return () => {
      ClientMediator.unregister(regId);
    };
  }, [battleMapId]);

  useEffect(() => {
    const updatePos = (e) => {
      let pos = { x: e.clientX, y: e.clientY };
      const parent = popupRef.current.parentElement;
      const parentRect = parent.getBoundingClientRect();
      if (popupRef.current) {
        popupRef.current.style.left = pos.x - parentRect.left + "px";
        popupRef.current.style.top = pos.y - parentRect.top + "px";
      }
    };

    if (show) {
      popupRef.current.style.display = "block";
      document.addEventListener("mousemove", updatePos);
    } else {
      popupRef.current.style.display = "none";
      document.removeEventListener("mousemove", updatePos);
    }

    return () => {
      document.removeEventListener("mousemove", updatePos);
    };
  }, [show]);

  return (
    <div ref={popupRef} className="nm_bm_popup">
      {content}
    </div>
  );
};
