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
import ClientMediator from "../../../ClientMediator";
import CollectionSyncer from "../../uiComponents/base/CollectionSyncer";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { FaMinusCircle } from "react-icons/fa";
import { Image } from "@chakra-ui/react";
import CardSettingsPanel from "../settings/CardSettingsPanel";
import { GiGears } from "react-icons/gi";
import DTreeListItem from "../../uiComponents/base/List/DTreeListItem";

export const CardsPanel = ({ state }) => {
  const [panels, setPanels] = React.useState([]);
  const [currentPlayer, setCurrentPlayer] = React.useState(null);
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
    {
      key: "owner",
      required: false,
      label: "Owner",
      toolTip: "Owner of card.",
      type: "playerSelect",
    },
  ];

  const panelRef = React.useRef(panels);
  panelRef.current = panels;

  React.useEffect(() => {
    const getData = async () => {
      let cards = await WebHelper.getAsync("materials/getcards");
      setPanels(cards);
      let currentPlayer = ClientMediator.sendCommand(
        "Game",
        "GetCurrentPlayer",
        {},
        true
      );

      var ownerId = ClientMediator.sendCommand("Game", "GetOwner");

      if (currentPlayer.id === ownerId) {
        let templates = await WebHelper.getAsync("materials/gettemplatesfull");
        setTemplates(templates);
      }
      setCurrentPlayer(currentPlayer);
    };
    getData();
  }, []);

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Cards`);

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
                ...data,
                id: null,
                templateId: selectedTemplate?.id,
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
                label={"Edit"}
                icon={GiGears}
                onClick={() => {
                  DockableHelper.NewFloating(
                    state,
                    <CardSettingsPanel cardId={item.id} />
                  );
                }}
              />
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
          <DTreeListItem
            gap={"15px"}
            width={"300"}
            entityId={x.id}
            entityType={"CardModel"}
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
          </DTreeListItem>
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
