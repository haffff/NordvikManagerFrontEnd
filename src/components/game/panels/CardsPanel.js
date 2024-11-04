import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import BasePanel from "../../uiComponents/base/BasePanel";
import DListItem from "../../uiComponents/base/List/DListItem";
import DLabel from "../../uiComponents/base/Text/DLabel";
import WebHelper from "../../../helpers/WebHelper";
import DockableHelper from "../../../helpers/DockableHelper";
import WebSocketManagerInstance from "../WebSocketManager";
import CardPanel from "./CardPanel";
import DTreeList from "../../uiComponents/treeList/DTreeList";
import InputModal from "../../uiComponents/base/Modals/InputModal";
import useGame from "../../uiComponents/hooks/useGameHook";
import ClientMediator from "../../../ClientMediator";
import CollectionSyncer from "../../uiComponents/base/CollectionSyncer";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { FaMinusCircle } from "react-icons/fa";
import { Image } from "@chakra-ui/react";

export const CardsPanel = ({ state }) => {
  const [panels, setPanels] = React.useState([]);
  const [currentPlayer, setCurrentPlayer] = React.useState(null);
  const game = useGame();
  const openRef = React.useRef(null);
  const [templates, setTemplates] = React.useState([]);
  const createConfig = [
    {
      key: "name",
      required: true,
      label: "Name",
      toolTip: "Name of card.",
      type: "string",
    },
    {
      key: "template",
      required: true,
      label: "Template",
      toolTip: "Name of template.",
      type: "select",
      options: templates.map((x) => {
        return { value: x.id, label: x.name };
      }),
    },
  ];

  const panelRef = React.useRef(panels);
  panelRef.current = panels;

  React.useEffect(() => {
    if (!game) {
      return;
    }
    WebHelper.get(
      "materials/getcards",
      (response) => {
        setPanels(response);
      },
      (error) => console.log(error)
    );
    let currentPlayer = ClientMediator.sendCommand(
      "Game",
      "GetCurrentPlayer",
      {},
      true
    );
    if (currentPlayer.id === game.master?.id) {
      WebHelper.get(
        "materials/gettemplatesfull",
        (response) => {
          setTemplates(response);
        },
        (error) => console.log(error)
      );
    }
    setCurrentPlayer(currentPlayer);
  }, [game]);

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Cards`);

  if (!game) {
    return <></>;
  }

  return (
    <BasePanel>
      <InputModal
        title="Create new card"
        getConfigDict={() => {
          return [...createConfig];
        }}
        openRef={openRef}
        onCloseModal={(data, success) => {
          if (success) {
            let selectedTemplate = templates.find(
              (x) => data.template === x.id
            );
            WebSocketManagerInstance.Send({
              command: "card_add",
              data: {
                ...selectedTemplate,
                id: null,
                templateId: selectedTemplate?.id,
                name: data.name,
                content: selectedTemplate.content,
              },
            });
          }
        }}
      />

      <DTreeList
        withAddItem={true}
        entityType={"CardModel"}
        items={panels}
        onAddItem={() => {
          openRef.current({ template: templates[0]?.id });
        }}
        onGenerateEditButtons={(item) => {
          return (
            <>
              <DListItemButton
                label={"Delete"}
                icon={FaMinusCircle}
                color={"red"}
                onClick={() => {
                  WebSocketManagerInstance.Send({
                    command: `card_delete`,
                    data: item.id,
                  });
                }}
              />
            </>
          );
        }}
        generateItem={(x) => (
          <DListItem
            gap={"15px"}
            width={"300"}
            key={x.id}
            onClick={() => {
              DockableHelper.NewFloating(
                state,
                <CardPanel name={x.name} state={state} id={x.id} />
              );
            }}
          >
            <Image src={x.image} width={"50px"} height={"50px"} />
            <DLabel>{x.name}</DLabel>
          </DListItem>
        )}
      ></DTreeList>
      <CollectionSyncer
        collection={panels}
        setCollection={setPanels}
        commandPrefix={"card"}
      />
      <CollectionSyncer
        collection={templates}
        setCollection={setTemplates}
        commandPrefix={"template"}
      />
    </BasePanel>
  );
};
export default CardsPanel;
