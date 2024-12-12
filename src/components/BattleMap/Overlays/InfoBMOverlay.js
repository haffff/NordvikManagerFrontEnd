import { useEffect, useRef, useState } from "react";
import ClientMediator from "../../../ClientMediator";
import "../../../stylesheets/battlemap.css";

export const InfoBMOverlay = ({ battleMapId }) => {
  const [show, setShow] = useState(false);
  const [content, setPopupContent] = useState(undefined);
  const popupRef = useRef(undefined);

  useEffect(() => {
    console.log("Registering overlay for battlemap " + battleMapId);
    ClientMediator.register({
      panel: "battlemap",
      id: "BattleMap_Overlay_" + battleMapId,
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
      ClientMediator.unregister("BattleMap_Overlay_" + battleMapId);
    };
  }, []);

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
