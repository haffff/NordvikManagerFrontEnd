import { Flex } from '@chakra-ui/react';
import * as React from 'react';
import { MdOpenWith } from 'react-icons/md';
import '../../../stylesheets/panel.css';
import DockableHelper from '../../../helpers/DockableHelper';
import * as Dockable from "@hlorenzi/react-dockable";
import { useDragOptimization } from './DragOptimizationContext';

// ── Drag overlay ──────────────────────────────────────────────────────────────
// Consumes the drag context and renders the overlay + visibility wrapper.
// Kept as a separate component so that drag-context re-renders are isolated here
// and never propagate into the panel's children.
const DragOverlay = React.memo(({ children, currentPanel }) => {
    const { isDragging, draggedPanel } = useDragOptimization();
    const isThisPanelDragged = isDragging && draggedPanel && draggedPanel === currentPanel;

    return (
        <>
            <Flex
                direction="column"
                width="100%"
                height="100%"
                visibility={isThisPanelDragged ? 'hidden' : 'visible'}
                aria-hidden={isThisPanelDragged}
            >
                {children}
            </Flex>

            {isThisPanelDragged && (
                <Flex
                    position="absolute"
                    inset={0}
                    direction="column"
                    align="center"
                    justify="center"
                    gap="8px"
                    color="#888"
                    fontSize="13px"
                    userSelect="none"
                    pointerEvents="none"
                >
                    <MdOpenWith size={32} style={{ opacity: 0.5 }} />
                    Moving panel...
                </Flex>
            )}
        </>
    );
});

// ── Base panel ────────────────────────────────────────────────────────────────

const BasePanelComponent = (props) => {
    const { children, baseRef, ...rest } = props;

    const ctx = Dockable.useContentContext();
    const currentPanel = ctx?.layoutContent?.panel;

    return (
        <Flex ref={baseRef} {...rest} className='nm_basePanel' position="relative">
            <DragOverlay currentPanel={currentPanel}>
                {children}
            </DragOverlay>
        </Flex>
    );
};

// Memoize with custom comparison to prevent re-renders during drag operations
export const BasePanel = React.memo(BasePanelComponent, (prevProps, nextProps) => {
    const globalState = DockableHelper.getGlobalState();
    const isDraggingAnyPanel = globalState?.ref?.current?.draggedPanel !== undefined && globalState?.ref?.current?.draggedPanel !== null;

    if (isDraggingAnyPanel) {
        return true; // Prevent re-render
    }

    // When not dragging, use shallow comparison of props
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);

    if (prevKeys.length !== nextKeys.length) return false;

    for (const key of prevKeys) {
        if (prevProps[key] !== nextProps[key]) return false;
    }

    return true;
});

export default BasePanel;
