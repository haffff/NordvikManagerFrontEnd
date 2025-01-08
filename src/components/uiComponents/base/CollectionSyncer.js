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
}) => {
  const collectionRef = React.useRef(collection);

  collectionRef.current = collection;

  const HandleMessage = (response) => {
    const collection = collectionRef.current;

    if (response.result && !response.command.endsWith("add")) {
      // error
      return;
    }

    switch (response.command) {
      case `${commandPrefix}_add`:
      case `${addCommand}`:
        setCollection([...collection, response.data]);
        if (onAdd) {
          onAdd(response.data, response);
        }
        if (onAnyChange) {
          onAnyChange(response);
        }
        break;
      case `${commandPrefix}_update`:
      case `${updateCommand}`:
        let updateIndex = collection.findIndex(
          (x) => x.id === response.data.id
        );
        if (updateIndex !== -1) {
          if (incrementalUpdate) {
            collection[updateIndex] = {
              ...collection[updateIndex],
              ...response.data,
            };
          } else {
            collection[updateIndex] = response.data;
          }

          setCollection([...collection]);
        }
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
        let removeIndex = collection.findIndex((x) => x.id === response.data);
        if (removeIndex !== -1) {
          collection.splice(removeIndex, 1);
          setCollection([...collection]);
        }
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
