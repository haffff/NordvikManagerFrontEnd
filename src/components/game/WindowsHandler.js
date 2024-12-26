import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

export const WindowsHandler = () => {
  useEffect(() => {}, []);

  return <></>;
};

export const NewWindow = ({ children, close, x, y }) => {
  const newWindow = React.useRef(null);
  const [loaded, setLoaded] = React.useState(false);

  useEffect(() => {
    newWindow.current = window.open(
      "about:blank",
      "newWin",
      `width=400,height=400,left=${x ?? 100},top=${y ?? 100}`
    );

    if(!newWindow.current) {
      return;
    }

    document.head.querySelectorAll("link, style").forEach((htmlElement) => {
      newWindow.current.document.head.appendChild(htmlElement.cloneNode(true));
    });
    setLoaded(true);
    return () => newWindow.current?.close();
  }, []);

  if (newWindow.current === null) {
    return null;
  }

  newWindow.current.onbeforeunload = () => {
    if (close) {
      close();
    }
  };

  return createPortal(children, newWindow.current.document.body);
};
