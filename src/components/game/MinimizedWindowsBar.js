import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { IoClose } from "@react-icons/all-files/io5/IoClose";

// The minimized floating windows, as chips in the status bar. Takes the live dock
// state (not useStableDockState's) so it re-renders on each commit and sees panels
// being minimized, restored and closed.
export const MinimizedWindowsBar = ({ state }) => {
  const panels = Dockable.getMinimizedPanels(state.ref.current);
  if (panels.length === 0) return null;

  const restore = (panel) => {
    Dockable.restorePanel(state.ref.current, panel);
    state.commit();
  };

  const close = (ev, panel) => {
    ev.stopPropagation();
    Dockable.closePanel(state.ref.current, panel);
    state.commit();
  };

  return (
    <div className="nm_minimizedWindows">
      {panels.map((panel) => {
        const content = panel.contentList[panel.currentTabIndex] ?? panel.contentList[0];
        const title = content?.title || "Window";
        const extraTabs = panel.contentList.length - 1;
        return (
          <div
            key={panel.id}
            className="nm_minimizedWindow"
            role="button"
            tabIndex={0}
            title={`Restore ${title}`}
            onClick={() => restore(panel)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                restore(panel);
              }
            }}
          >
            <span className="nm_minimizedWindow_title">{title}</span>
            {extraTabs > 0 && <span className="nm_minimizedWindow_count">+{extraTabs}</span>}
            <button
              type="button"
              className="nm_minimizedWindow_close"
              title={`Close ${title}`}
              aria-label={`Close ${title}`}
              onClick={(ev) => close(ev, panel)}
            >
              <IoClose />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default MinimizedWindowsBar;
