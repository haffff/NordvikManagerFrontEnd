import { useEffect, useRef, useState } from "react";
import ClientMediator from "../../../ClientMediator";
import "../../../stylesheets/battlemap.css";

export const InfoBMOverlay = ({ battleMapId }) => {
  const [show, setShow] = useState(false);
  const [content, setPopupContent] = useState(undefined);
  const popupRef = useRef(undefined);

  useEffect(() => {
    if (!battleMapId) {
      console.warn('InfoBMOverlay: no battleMapId provided, skipping registration');
      return;
    }
    const regId = "BattleMap_Overlay_" + battleMapId;
    console.log("Registering overlay for battlemap " + battleMapId);
    ClientMediator.unregister(regId);
    ClientMediator.register({
      panel: "battlemap",
      id: regId,
      contextId: battleMapId,
      ShowOverlay: ({ content }) => {
        setPopupContent(content);
        setShow(true);
      },
      HideOverlay: () => {
        setPopupContent(undefined);
        setShow(false);
      },
    });

    return () => {
      ClientMediator.unregister(regId);
    };
  }, [battleMapId]);

  useEffect(() => {
    if (show) {
      popupRef.current.style.display = "block";
    } else {
      popupRef.current.style.display = "none";
    }
  }, [show]);

  return (
    <div ref={popupRef} className="nm_bm_overlay">
      {content}
    </div>
  );
};
