import * as React from "react";
import Subscribable from "./Subscribable";

export const CollectionSyncer = ({
  collection,
  setCollection,
  setSelectedItem,
  onAdd,
  onUpdate,
  onDelete,
  onSelectedChanged,
  commandPrefix,
  addCommand,
  deleteCommand,
  updateCommand,
  selectItemCommand,
  onAnyChange,
  incrementalUpdate,
  paused,
}) => {
  const collectionRef = React.useRef(collection);

  collectionRef.current = collection;

  // Changes go through setCollection(previous => next): they never edit the list in React
  // state, and events that arrive before a re-render each apply on top of the one before.
  // A list that isn't loaded yet (null/undefined) is left alone.
  const change = (next) =>
    setCollection((previous) => (Array.isArray(previous) ? next(previous) : previous));

  const HandleMessage = (response) => {
    if (paused) return;
    const collection = collectionRef.current;

    if (response.result && response.result != "Ok") {
      // error
      return;
    }

    switch (response.command) {
      case `${commandPrefix}_add`:
      case `${addCommand}`:
        change((list) => [...list, response.data]);
        if (onAdd) {
          onAdd(response.data, response);
        }
        if (onAnyChange) {
          onAnyChange(response);
        }
        break;
      case `${commandPrefix}_update`:
      case `${updateCommand}`:
        change((list) =>
          list.some((x) => x.id === response.data.id)
            ? list.map((x) =>
                x.id === response.data.id
                  ? incrementalUpdate
                    ? { ...x, ...response.data }
                    : response.data
                  : x
              )
            : list
        );
        if (onUpdate) {
          onUpdate(response.data, response);
        }
        if (onAnyChange) {
          onAnyChange(response);
        }
        break;
      case `${commandPrefix}_delete`:
      case `${commandPrefix}_remove`:
      case `${deleteCommand}`:
        change((list) =>
          list.some((x) => x.id === response.data)
            ? list.filter((x) => x.id !== response.data)
            : list
        );
        if (onDelete) {
          onDelete(response.data, response);
        }
        if (onAnyChange) {
          onAnyChange(response);
        }
        break;
      case `${commandPrefix}_select`:
      case `${selectItemCommand}`:
        if (setSelectedItem) {
          setSelectedItem(
            collection.find(
              (x) => x.id == response.data || x.id == response.data?.id
            )
          );
        }
        if (onSelectedChanged) {
          onSelectedChanged(response.data, response);
        }
        if (onAnyChange) {
          onAnyChange(response);
        }
        break;
      default:
        break;
    }
  };

  return (
    <Subscribable commandPrefix={commandPrefix} onMessage={HandleMessage} />
  );
};
export default CollectionSyncer;
