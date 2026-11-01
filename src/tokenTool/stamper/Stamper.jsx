import * as React from "react";
import { Box, Button, Flex, Heading, Stack } from "@chakra-ui/react";
import { stampLayout, stamp, panBy } from "./stamp";

// The token stamper: a picture (e.g. a portrait) framed by dragging and zooming, cut to
// a circle and ringed if wanted, then used as the token's picture or downloaded as PNG.
// Everything stays in the browser.

const SHOWN = 256; // on-screen size of the stamped picture
const MAX_ZOOM = 8;
const field = { display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" };

const decode = (file) => createImageBitmap(file);
const baseName = (name) => (name ?? "picture").replace(/\.[^.]+$/, "");
const toPng = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

/** @param onUse (blob, fileName) => void; loadImage: file → drawable with width/height (tests swap it) */
export function Stamper({ onUse, loadImage = decode }) {
  const canvasEl = React.useRef(null);
  const drag = React.useRef(null);
  const [image, setImage] = React.useState(null);
  const [fileName, setFileName] = React.useState(null);
  const [view, setView] = React.useState(null); // { imgW, imgH, zoom, panX, panY }
  const [size, setSize] = React.useState(256);
  const [circle, setCircle] = React.useState(true);
  const [ringWidth, setRingWidth] = React.useState(0);
  const [ringColor, setRingColor] = React.useState("#c9a227");
  const [error, setError] = React.useState(null);

  const choose = async (file) => {
    if (!file) return;
    try {
      const picture = await loadImage(file);
      setImage(picture);
      setFileName(file.name);
      setView({ imgW: picture.width, imgH: picture.height, zoom: 1, panX: 0, panY: 0 });
      setError(null);
    } catch {
      setError("That file couldn't be read as a picture.");
    }
  };

  // The canvas is the output size; CSS shows it at SHOWN pixels.
  React.useEffect(() => {
    const canvas = canvasEl.current;
    if (!canvas || !image || !view) return;
    canvas.width = size;
    canvas.height = size;
    stamp(canvas.getContext("2d"), image, {
      size, layout: stampLayout(view), circle, ring: ringWidth > 0 ? { width: ringWidth * (size / SHOWN), color: ringColor } : null,
    });
  }, [image, view, size, circle, ringWidth, ringColor]);

  const zoomBy = (change) =>
    setView((v) => v && panBy({ ...v, zoom: Math.min(Math.max(change(v.zoom), 1), MAX_ZOOM) }, { dx: 0, dy: 0, shown: SHOWN }));
  const zoomTo = (zoom) => zoomBy(() => zoom);

  // The wheel zooms. React's onWheel is passive and can't stop the page scrolling, so a
  // listener of our own.
  const frame = React.useRef(null);
  React.useEffect(() => {
    const el = frame.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      zoomBy((zoom) => zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e) => {
    if (!view) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setView((v) => v && panBy(v, { dx, dy, shown: SHOWN }));
  };
  const endDrag = () => { drag.current = null; };

  const outputName = `${baseName(fileName)}-token.png`;
  const use = async () => onUse?.(await toPng(canvasEl.current), outputName);
  const download = async () => {
    const url = URL.createObjectURL(await toPng(canvasEl.current));
    const link = document.createElement("a");
    link.href = url;
    link.download = outputName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack gap="8px">
      <Heading size="sm">Token stamper</Heading>
      <label style={field}>
        Picture <input type="file" accept="image/*" aria-label="Picture to stamp" onChange={(e) => choose(e.target.files?.[0])} />
      </label>
      <Box
        ref={frame}
        w={`${SHOWN}px`} h={`${SHOWN}px`} borderRadius="4px" cursor={view ? "grab" : "default"}
        style={{ backgroundImage: "repeating-conic-gradient(#555 0 25%, #444 0 50%)", backgroundSize: "16px 16px", touchAction: "none" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
      >
        <canvas ref={canvasEl} aria-label="Stamped picture" width={size} height={size} style={{ width: SHOWN, height: SHOWN, display: image ? "block" : "none" }} />
      </Box>
      <Flex gap="12px" wrap="wrap">
        <label style={field}>
          Zoom
          <input type="range" min="1" max={MAX_ZOOM} step="0.05" value={view?.zoom ?? 1} disabled={!view} aria-label="Zoom" onChange={(e) => zoomTo(Number(e.target.value))} />
        </label>
        <label style={field}><input type="checkbox" checked={circle} onChange={(e) => setCircle(e.target.checked)} /> Circle</label>
      </Flex>
      <Flex gap="12px" wrap="wrap">
        <label style={field}>
          Ring
          <input type="range" min="0" max="24" step="1" value={ringWidth} aria-label="Ring width" onChange={(e) => setRingWidth(Number(e.target.value))} />
        </label>
        <input type="color" value={ringColor} aria-label="Ring colour" onChange={(e) => setRingColor(e.target.value)} />
        <label style={field}>
          Size
          <select value={size} aria-label="Output size" onChange={(e) => setSize(Number(e.target.value))}>
            <option value={256}>256 px</option>
            <option value={512}>512 px</option>
          </select>
        </label>
      </Flex>
      <Flex gap="8px">
        <Button size="sm" disabled={!image} onClick={use}>Use as token picture</Button>
        <Button size="sm" variant="outline" disabled={!image} onClick={download}>Download PNG</Button>
      </Flex>
      {error && <Box color="fg.error" fontSize="13px" role="alert">{error}</Box>}
    </Stack>
  );
}

export default Stamper;
