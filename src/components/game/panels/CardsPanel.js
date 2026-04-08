import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import DockableHelper from "../../../helpers/DockableHelper";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import CardPanel from "./CardPanel";
import DTreeList from "../../uiComponents/treeList/DTreeList";
import InputModal from "../../uiComponents/base/Modals/InputModal";
import ClientMediator from "../../../ClientMediator";
import { usePermissions } from "../../../contexts/PermissionsContext";
import { ENTITY_TYPES, PERM } from "../../BattleMap/helpers/permissionBits";
import CollectionSyncer from "../../uiComponents/base/CollectionSyncer";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { FaMinusCircle } from "react-icons/fa";
import { Box, Flex, Image, Text } from "@chakra-ui/react";
import CardSettingsPanel from "../settings/CardSettingsPanel";
import { GiGears } from "react-icons/gi";
import DTreeListItem from "../../uiComponents/base/List/DTreeListItem";

export const CardsPanel = ({ state }) => {
  const [panels, setPanels] = React.useState([]);
  const [currentPlayer, setCurrentPlayer] = React.useState(null);
  const openRef = React.useRef(null);
  const treeRefreshRef = React.useRef(null);
  const [templates, setTemplates] = React.useState([]);

  const { hasEntityPermission } = usePermissions();
  const gameId = React.useMemo(() => ClientMediator.sendCommand("Game", "GetGameId"), []);
  const canEditFolders = hasEntityPermission(ENTITY_TYPES.GAME, gameId, PERM.EDIT);
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

  const loadData = React.useCallback(async () => {
    let cards = await WebHelper.getAsync("materials/getcards");
    setPanels(cards);
    let currentPlayer = ClientMediator.sendCommand("Game", "GetCurrentPlayer", {}, true);
    var ownerId = ClientMediator.sendCommand("Game", "GetOwner");
    if (currentPlayer.id === ownerId) {
      let templates = await WebHelper.getAsync("materials/gettemplatesfull");
      setTemplates(templates);
    }
    setCurrentPlayer(currentPlayer);
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

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
                ...data,
                id: null,
                templateId: selectedTemplate?.id,
              },
            });
          }
        }}
      />

      <DTreeList
        withAddItem={true}
        entityType={"CardModel"}
        items={panels}
        refreshRef={treeRefreshRef}
        onRefresh={loadData}
        canEditFolders={canEditFolders}
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
        generateItem={(x) => {
          const templateName = templates.find((t) => t.id === x.templateId)?.name;
          // Derive a stable accent color from the card name for the initial avatar
          const AVATAR_COLORS = ["blue.800","teal.800","purple.800","orange.800","cyan.800","pink.800"];
          const colorIdx = (x.name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length;
          const avatarBg = AVATAR_COLORS[colorIdx];

          return (
            <DTreeListItem
              gap="10px"
              padding="2px"
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
              {/* Thumbnail or initial avatar */}
              {x.image
                ? <Image
                    src={x.image}
                    boxSize="40px"
                    borderRadius="md"
                    objectFit="cover"
                    flexShrink={0}
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                  />
                : <Flex
                    boxSize="40px"
                    borderRadius="md"
                    bg={avatarBg}
                    align="center"
                    justify="center"
                    flexShrink={0}
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                  >
                    <Text fontWeight="bold" fontSize="md" color="whiteAlpha.800">
                      {x.name?.[0]?.toUpperCase() ?? "?"}
                    </Text>
                  </Flex>
              }

              {/* Name + template subtitle */}
              <Box flex="1" minW={300}>
                <Text fontWeight="semibold" fontSize="sm" noOfLines={1}>
                  {x.name}
                </Text>
                {templateName && (
                  <Text fontSize="xs" color="gray.400" noOfLines={1}>
                    {templateName}
                  </Text>
                )}
              </Box>
            </DTreeListItem>
          );
        }}
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
