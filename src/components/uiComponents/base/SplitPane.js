import * as React from "react";
import { Box, Button, Flex, Icon } from "@chakra-ui/react";
import { FaChevronLeft } from "@react-icons/all-files/fa/FaChevronLeft";
import { ResizeDivider, useDragResize } from "../ResizeDivider";
import themeColors from "../../../helpers/themeColors";

// Narrower than this (the pane's own width, so a thin dock window counts too) the list
// and the detail take turns instead of sitting side by side.
export const SPLIT_NARROW_BELOW = 560;

/**
 * Which side a narrow SplitPane shows. Owned by the panel, so its select handlers can
 * say "show the detail", even for the row that is already selected.
 */
export function useSplitView(initial = "list") {
  const [view, setView] = React.useState(initial);
  const showDetail = React.useCallback(() => setView("detail"), []);
  const showList = React.useCallback(() => setView("list"), []);
  return React.useMemo(() => ({ view, showDetail, showList }), [view, showDetail, showList]);
}

// The element's width, kept at the last known one while it is 0 (not laid out yet, or a
// hidden tab), where 0 means unknown.
function usePaneWidth(ref) {
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/**
 * A list beside its selected entry's detail. Below SPLIT_NARROW_BELOW it shows one at a
 * time: the list, then the detail with a Back button. Both stay mounted either way (the
 * hidden one gets display:none), so the list keeps its folders and scroll, and the detail
 * its unsaved edits, across Back and resizes.
 *
 * renderDivider(onMouseDown) draws a panel's own divider (e.g. one that collapses a side);
 * listHidden / detailHidden are such collapses, honoured only side by side.
 */
export const SplitPane = ({
  split,
  list,
  detail,
  backLabel = "list",
  initialFraction = 0.35,
  narrowBelow = SPLIT_NARROW_BELOW,
  renderDivider,
  listHidden = false,
  detailHidden = false,
}) => {
  const ref = React.useRef(null);
  const width = usePaneWidth(ref);
  const narrow = width > 0 && width < narrowBelow;
  const { fracs, onDividerMouseDown } = useDragResize(ref, [initialFraction]);
  const onMouseDown = (e) => onDividerMouseDown(0, e);

  const showList = narrow ? split.view !== "detail" : !listHidden;
  const showDetail = narrow ? split.view === "detail" : !detailHidden;

  let listWidth = `${fracs[0] * 100}%`;
  if (narrow || detailHidden) listWidth = "auto";

  return (
    <Flex ref={ref} className="nm_splitPane" data-narrow={narrow || undefined} height="100%" width="100%" overflow="hidden">
      <Flex
        className="nm_splitPaneList"
        direction="column"
        width={listWidth}
        flexGrow={narrow || detailHidden ? 1 : 0}
        flexShrink={0}
        minW={0}
        height="100%"
        overflow="hidden"
        display={showList ? "flex" : "none"}
      >
        {list}
      </Flex>

      <Box display={narrow ? "none" : "contents"}>
        {renderDivider ? renderDivider(onMouseDown) : <ResizeDivider onMouseDown={onMouseDown} />}
      </Box>

      <Flex
        className="nm_splitPaneDetail"
        direction="column"
        flex={1}
        minW={0}
        height="100%"
        overflow="hidden"
        display={showDetail ? "flex" : "none"}
      >
        {narrow && (
          <Flex flexShrink={0} px="4px" py="4px" borderBottomWidth="1px" borderColor={themeColors.divider}>
            <Button size="sm" variant="ghost" onClick={split.showList}>
              <Icon as={FaChevronLeft} boxSize="12px" /> Back to {backLabel}
            </Button>
          </Flex>
        )}
        {detail}
      </Flex>
    </Flex>
  );
};

export default SplitPane;
