// Icons the app uses that @react-icons/all-files (per-icon modules) doesn't have,
// copied from react-icons 4.12. Static imports go through per-icon modules so the
// full react-icons packs stay out of the main bundle: they're only loaded on
// demand, for icons users pick (helpers/ReactIconPackLoaders.js).
import { GenIcon } from "react-icons/lib";

export function MdCircle (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24"},"child":[{"tag":"path","attr":{"fill":"none","d":"M0 0h24v24H0z"}},{"tag":"path","attr":{"d":"M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2z"}}]})(props);
};
export function MdOutlineFormatColorFill (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24"},"child":[{"tag":"path","attr":{"fill":"none","d":"M0 0h24v24H0z"}},{"tag":"path","attr":{"d":"M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 000 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5zM2 20h20v4H2v-4z"}}]})(props);
};
export function MdTextIncrease (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24"},"child":[{"tag":"path","attr":{"fill":"none","d":"M0 0h24v24H0z"}},{"tag":"path","attr":{"d":"M.99 19h2.42l1.27-3.58h5.65L11.59 19h2.42L8.75 5h-2.5L.99 19zm4.42-5.61L7.44 7.6h.12l2.03 5.79H5.41zM20 11h3v2h-3v3h-2v-3h-3v-2h3V8h2v3z"}}]})(props);
};
export function FaUsersSlash (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 640 512"},"child":[{"tag":"path","attr":{"d":"M132.65,212.32,36.21,137.78A63.4,63.4,0,0,0,32,160a63.84,63.84,0,0,0,100.65,52.32Zm40.44,62.28A63.79,63.79,0,0,0,128,256H64A64.06,64.06,0,0,0,0,320v32a32,32,0,0,0,32,32H97.91A146.62,146.62,0,0,1,173.09,274.6ZM544,224a64,64,0,1,0-64-64A64.06,64.06,0,0,0,544,224ZM500.56,355.11a114.24,114.24,0,0,0-84.47-65.28L361,247.23c41.46-16.3,71-55.92,71-103.23A111.93,111.93,0,0,0,320,32c-57.14,0-103.69,42.83-110.6,98.08L45.46,3.38A16,16,0,0,0,23,6.19L3.37,31.46A16,16,0,0,0,6.18,53.91L594.53,508.63A16,16,0,0,0,617,505.82l19.64-25.27a16,16,0,0,0-2.81-22.45ZM128,403.21V432a48,48,0,0,0,48,48H464a47.45,47.45,0,0,0,12.57-1.87L232,289.13C173.74,294.83,128,343.42,128,403.21ZM576,256H512a63.79,63.79,0,0,0-45.09,18.6A146.29,146.29,0,0,1,542,384h66a32,32,0,0,0,32-32V320A64.06,64.06,0,0,0,576,256Z"}}]})(props);
};

// Used by the Chakra snippets in components/ui (lu, hi2 have no per-icon modules).
export function LuX (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":"2","strokeLinecap":"round","strokeLinejoin":"round"},"child":[{"tag":"path","attr":{"d":"M18 6 6 18"}},{"tag":"path","attr":{"d":"m6 6 12 12"}}]})(props);
};
export function LuMoon (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":"2","strokeLinecap":"round","strokeLinejoin":"round"},"child":[{"tag":"path","attr":{"d":"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"}}]})(props);
};
export function LuSun (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":"2","strokeLinecap":"round","strokeLinejoin":"round"},"child":[{"tag":"circle","attr":{"cx":"12","cy":"12","r":"4"}},{"tag":"path","attr":{"d":"M12 2v2"}},{"tag":"path","attr":{"d":"M12 20v2"}},{"tag":"path","attr":{"d":"m4.93 4.93 1.41 1.41"}},{"tag":"path","attr":{"d":"m17.66 17.66 1.41 1.41"}},{"tag":"path","attr":{"d":"M2 12h2"}},{"tag":"path","attr":{"d":"M20 12h2"}},{"tag":"path","attr":{"d":"m6.34 17.66-1.41 1.41"}},{"tag":"path","attr":{"d":"m19.07 4.93-1.41 1.41"}}]})(props);
};
export function LuCheck (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":"2","strokeLinecap":"round","strokeLinejoin":"round"},"child":[{"tag":"polyline","attr":{"points":"20 6 9 17 4 12"}}]})(props);
};
export function LuPipette (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":"2","strokeLinecap":"round","strokeLinejoin":"round"},"child":[{"tag":"path","attr":{"d":"m2 22 1-1h3l9-9"}},{"tag":"path","attr":{"d":"M3 21v-3l9-9"}},{"tag":"path","attr":{"d":"m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"}}]})(props);
};
export function LuChevronRight (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":"2","strokeLinecap":"round","strokeLinejoin":"round"},"child":[{"tag":"path","attr":{"d":"m9 18 6-6-6-6"}}]})(props);
};
export function HiChevronLeft (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24","fill":"currentColor","aria-hidden":"true"},"child":[{"tag":"path","attr":{"fillRule":"evenodd","d":"M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z","clipRule":"evenodd"}}]})(props);
};
export function HiChevronRight (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 24 24","fill":"currentColor","aria-hidden":"true"},"child":[{"tag":"path","attr":{"fillRule":"evenodd","d":"M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z","clipRule":"evenodd"}}]})(props);
};
export function HiMiniEllipsisHorizontal (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 20 20","fill":"currentColor","aria-hidden":"true"},"child":[{"tag":"path","attr":{"d":"M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"}}]})(props);
};
