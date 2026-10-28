import * as React from 'react';
import DockableHelper from '../../../helpers/DockableHelper';

const DragOptimizationContext = React.createContext({
  isDragging: false,
  isDraggedPanel: false
});

export const DragOptimizationProvider = ({ children }) => {
  const [dragState, setDragState] = React.useState({ isDragging: false, draggedPanel: null });  // Monitor global dockable state for changes using listener pattern
  React.useEffect(() => {
    let lastDraggedPanel = null;
    let lastIsDragging = false;

    const checkDragState = () => {
      const globalState = DockableHelper.getGlobalState();
      const draggedPanel = globalState?.ref?.current?.draggedPanel;
      const isDragging = draggedPanel !== undefined && draggedPanel !== null;

      console.log("checkDragState: isDragging=", isDragging, " draggedPanel=", draggedPanel?.props?.syncId);

      // Only update state if something actually changed
      if (isDragging !== lastIsDragging || draggedPanel !== lastDraggedPanel) {
        lastIsDragging = isDragging;
        lastDraggedPanel = draggedPanel;
        
        setDragState({ isDragging, draggedPanel });
      }
    };

    // Check immediately on mount
    checkDragState();

    // Add listener for drag state changes - this will be notified by DockableHelper
    DockableHelper.addDragStateListener(checkDragState);

    return () => {
      DockableHelper.removeDragStateListener(checkDragState);
    };
  }, []);

  return (
    <DragOptimizationContext.Provider value={dragState}>
      {children}
    </DragOptimizationContext.Provider>
  );
};

export const useDragOptimization = () => {
  return React.useContext(DragOptimizationContext);
};

export default DragOptimizationContext;
