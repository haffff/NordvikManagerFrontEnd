// While a mouse button pressed in this page is held (moving or resizing a panel, a
// splitter, a map element), iframes stop taking the mouse. Otherwise, once the cursor
// passes over a sandboxed iframe (cards, chat roll templates), it gets the mousemove /
// mouseup the dock listens for on window, and the drag stops following the cursor.
// A press inside an iframe never reaches this document, so iframes stay usable.
export const POINTER_HELD_CLASS = 'nm_pointerHeld';

export function installIframePointerGuard(doc = document) {
  const win = doc.defaultView;
  const hold = (e) => { if (e.button === 0) doc.body.classList.add(POINTER_HELD_CLASS); };
  const release = () => doc.body.classList.remove(POINTER_HELD_CLASS);

  doc.addEventListener('mousedown', hold, true);
  doc.addEventListener('mouseup', release, true);
  doc.addEventListener('dragend', release, true); // native drag-and-drop fires no mouseup
  win.addEventListener('blur', release);

  return () => {
    doc.removeEventListener('mousedown', hold, true);
    doc.removeEventListener('mouseup', release, true);
    doc.removeEventListener('dragend', release, true);
    win.removeEventListener('blur', release);
  };
}
