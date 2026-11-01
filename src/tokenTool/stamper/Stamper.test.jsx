import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "../../components/ui/provider";
import { stubCanvasContext } from "../testCanvas";
import { Stamper } from "./Stamper";

// The stamper's page part: pick a picture, frame it (drag, zoom), choose circle and ring,
// then use it as the token's picture or download it.
const picture = { width: 800, height: 400 };
const file = new File(["png"], "portrait.png", { type: "image/png" });

const setup = (props = {}) => {
  const onUse = vi.fn();
  const loadImage = vi.fn(async () => picture);
  render(<Provider><Stamper onUse={onUse} loadImage={loadImage} {...props} /></Provider>);
  return { onUse, loadImage };
};
const choose = async () => {
  fireEvent.change(screen.getByLabelText("Picture to stamp"), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Use as token picture" })).toBeEnabled());
};

describe("Stamper", () => {
  beforeEach(() => {
    stubCanvasContext();
    // jsdom has no toBlob (and its Blob no text()): the blob notes the size it was made at.
    HTMLCanvasElement.prototype.toBlob = function (cb, type) { cb(Object.assign(new Blob([], { type }), { madeAt: this.width })); };
  });

  it("nothing to use until a picture is chosen", () => {
    setup();
    expect(screen.getByRole("button", { name: "Use as token picture" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeDisabled();
  });

  it("uses the stamped picture as a PNG of the chosen size", async () => {
    const { onUse, loadImage } = setup();
    await choose();
    expect(loadImage).toHaveBeenCalledWith(file);
    fireEvent.change(screen.getByLabelText("Output size"), { target: { value: "512" } });
    fireEvent.click(screen.getByRole("button", { name: "Use as token picture" }));
    await waitFor(() => expect(onUse).toHaveBeenCalled());
    const [blob, name] = onUse.mock.calls[0];
    expect(blob.type).toBe("image/png");
    expect(blob.madeAt).toBe(512);
    expect(name).toBe("portrait-token.png");
  });

  it("draws with the chosen circle and ring", async () => {
    setup();
    await choose();
    const canvas = screen.getByLabelText("Stamped picture");
    const ctx = canvas.getContext("2d");
    const arc = vi.fn();
    ctx.arc = arc;
    fireEvent.change(screen.getByLabelText("Ring width"), { target: { value: "10" } });
    await waitFor(() => expect(arc).toHaveBeenCalledWith(128, 128, 123, 0, Math.PI * 2));
    arc.mockClear();
    const strokeRect = vi.fn();
    ctx.strokeRect = strokeRect;
    fireEvent.click(screen.getByLabelText("Circle"));
    await waitFor(() => expect(strokeRect).toHaveBeenCalledWith(5, 5, 246, 246));
    expect(arc).not.toHaveBeenCalled();
  });

  it("the wheel zooms the picture, and doesn't scroll the page", async () => {
    setup();
    await choose();
    const frame = screen.getByLabelText("Stamped picture").parentElement;
    const wheel = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    fireEvent(frame, wheel);
    expect(wheel.defaultPrevented).toBe(true);
    await waitFor(() => expect(Number(screen.getByLabelText("Zoom").value)).toBeCloseTo(1.1));
  });

  it("downloads the PNG", async () => {
    setup();
    await choose();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });
});
