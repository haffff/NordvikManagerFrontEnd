import { bar } from "./bar";
import { label } from "./label";
import { button } from "./button";
import { iconSet } from "./iconSet";
import { ring } from "./ring";
import { rect, circle, polygon } from "./shapes";

/** The token editor's one-click parts, in the order a token file's groups are tried. */
export const PATTERNS = { iconSet, bar, label, button, ring, rect, circle, polygon };
