import * as Dockable from "@hlorenzi/react-dockable"

let globalDockableState = null;
let dragStateListeners = new Set();
let lastDraggedPanel = null;

export const DockableHelper = {
    NewFloating: (state,Element) => {
        let panel = Dockable.spawnFloating(state, Element);

        state.commit();
        
        return panel;
    },
    
    // Set the global dockable state - should be called during game initialization
    setGlobalState: (state) => {
        globalDockableState = state;
        
        // Start monitoring the state for drag changes
        if (state?.ref?.current) {
            startDragStateMonitoring();
        }
    },
    
    // Get the global dockable state for components that need drag state
    getGlobalState: () => {
        return globalDockableState;
    },
    
    // Add a listener for drag state changes
    addDragStateListener: (callback) => {
        dragStateListeners.add(callback);
    },
    
    // Remove a drag state listener
    removeDragStateListener: (callback) => {
        dragStateListeners.delete(callback);
    },
    
    // Manually notify listeners (for external calls if needed)
    notifyDragStateChange: () => {
        dragStateListeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in drag state listener:', error);
            }
        });
    }
}

// Monitor the dockable state object for changes to draggedPanel
function startDragStateMonitoring() {
    if (!globalDockableState?.ref?.current) {
        return;
    }

    // Check for changes every animation frame, but only when there are listeners
    const checkForDragChanges = () => {
        if (dragStateListeners.size > 0 && globalDockableState?.ref?.current) {
            const currentDraggedPanel = globalDockableState.ref.current.draggedPanel;
            
            if (currentDraggedPanel !== lastDraggedPanel) {
                console.log('Drag state changed:', { 
                    from: lastDraggedPanel?.props?.syncId || 'null', 
                    to: currentDraggedPanel?.props?.syncId || 'null' 
                });
                lastDraggedPanel = currentDraggedPanel;
                DockableHelper.notifyDragStateChange();
            }
        }
        
        // Continue monitoring only if we have listeners
        if (dragStateListeners.size > 0) {
            requestAnimationFrame(checkForDragChanges);
        }
    };

    // Start monitoring
    checkForDragChanges();
}

export default DockableHelper;