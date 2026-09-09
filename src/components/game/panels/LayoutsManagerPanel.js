import * as React from "react";
import { Badge, Box, For, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaCheck, FaEdit, FaPlus, FaSave, FaShareAlt, FaUserFriends, FaUsers, FaWrench } from "react-icons/fa";
import { IoIosRemoveCircleOutline } from "react-icons/io";
import Subscribable from "../../uiComponents/base/Subscribable";
import LayoutSettingsPanel from "../settings/LayoutSettingsPanel";
import LayoutHelper from "../../../helpers/LayoutCloneHelper";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import DListItem from "../../uiComponents/base/List/DListItem";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import CollectionSyncer from "../../uiComponents/base/CollectionSyncer";
import InputModal from "../../uiComponents/base/Modals/InputModal";
import ClientMediator from "../../../ClientMediator";
import UtilityHelper from "../../../helpers/UtilityHelper";
import { toaster } from "../../ui/toaster";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "../../ui/select";
import { createListCollection } from "@chakra-ui/react";
import { PERM } from "../../BattleMap/Helpers/permissionBits";

const EVERYONE = UtilityHelper.EmptyGuid;

// A layout is "shared with everyone" when the generic (Guid.Empty) permission row
// exists and carries the SEE bit. NOT_SET (-1) / NONE (0) mean not shared.
const isSharedBits = (bits) => typeof bits === "number" && bits > 0 && (bits & PERM.SEE) === PERM.SEE;

export const LayoutsManagerPanel = ({ state, battlemapsRef }) => {
  const [serverLayouts, setServerLayouts] = React.useState(undefined);
  const [selectedLayout, setSelectedLayout] = React.useState();
  const [shared, setShared] = React.useState({}); // layoutId -> bool (Read granted to Everyone)
  const gameIdRef = React.useRef(null);

  const nameModalRef = React.useRef();
  const renameTargetRef = React.useRef(null); // set = rename that layout; null = save-as-new

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Layouts");
  ctx.setPreferredSize(560, 640);

  const layoutsRef = React.useRef(serverLayouts);
  layoutsRef.current = serverLayouts;

  const refreshShareState = React.useCallback(async (layouts) => {
    const out = {};
    await Promise.all(
      (layouts ?? []).map(async (l) => {
        try {
          const perms = await WebHelper.getAsync(
            `security/permissions?entityId=${l.id}&entityType=LayoutModel`
          );
          out[l.id] = isSharedBits(perms?.[EVERYONE]);
        } catch {
          out[l.id] = false;
        }
      })
    );
    setShared(out);
  }, []);

  React.useEffect(() => {
    gameIdRef.current = ClientMediator.sendCommand("Game", "GetGameId");
    WebHelper.get("Battlemap/GetLayouts", (list) => {
      setServerLayouts(list);
      refreshShareState(list);
    });
    const current = ClientMediator.sendCommand("Game", "GetLayout");
    if (current) setSelectedLayout(current);
  }, [refreshShareState]);

  // Server clears Default on siblings but only re-broadcasts the one changed row.
  const onLayoutUpdate = (event) => {
    const d = event?.data;
    if (!d?.id) return;
    if (d.default === true) {
      setServerLayouts((prev) => prev?.map((l) => ({ ...l, default: l.id === d.id })));
    }
    if (d.name !== undefined) {
      setServerLayouts((prev) => prev?.map((l) => (l.id === d.id ? { ...l, name: d.name } : l)));
    }
  };

  const onPermissionUpdate = (event) => {
    const id = event?.data?.id;
    if (!id || !(layoutsRef.current ?? []).some((l) => l.id === id)) return;
    setShared((prev) => ({ ...prev, [id]: isSharedBits(event.data.permissions?.[EVERYONE]) }));
  };

  const applyLayout = (x) => {
    ClientMediator.sendCommand("Game", "SetLayout", x.id);
    setSelectedLayout(x);
    toaster.create({ title: "Layout applied", type: "success", duration: 4000 });
  };

  const setDefault = (id) => {
    WebSocketManagerInstance.Send(
      CommandFactory.CreateLayoutUpdateCommand({ id, default: true, gameModelId: gameIdRef.current })
    );
    setServerLayouts((prev) => prev?.map((l) => ({ ...l, default: l.id === id })));
    toaster.create({ title: "Default layout set", type: "success", duration: 3000 });
  };

  const overwriteWithCurrent = (x) => {
    if (!window.confirm(`Overwrite "${x.name}" with your current panel arrangement?`)) return;
    const clone = LayoutHelper.GetCloneForSaving(state.ref.current.rootPanel, battlemapsRef);
    WebSocketManagerInstance.Send(
      CommandFactory.CreateLayoutUpdateCommand({
        id: x.id,
        gameModelId: gameIdRef.current,
        value: JSON.stringify(clone),
      })
    );
    toaster.create({ title: `"${x.name}" updated`, type: "success", duration: 3000 });
  };

  const toggleShare = (x) => {
    const next = !shared[x.id];
    WebSocketManagerInstance.Send(
      CommandFactory.CreateUpdatePermissionsCommand(x.id, "LayoutModel", {
        [EVERYONE]: next ? PERM.SEE : PERM.NOT_SET,
      })
    );
    setShared((prev) => ({ ...prev, [x.id]: next }));
    toaster.create({
      title: next ? "Shared with all players" : "Sharing removed",
      type: "success",
      duration: 3000,
    });
  };

  const openRename = (x) => {
    renameTargetRef.current = x;
    nameModalRef.current({ name: x.name });
  };
  const openSaveAsNew = () => {
    renameTargetRef.current = null;
    nameModalRef.current({ name: "New layout" });
  };
  const onNameSubmit = (data, success) => {
    if (!success || !data.name) return;
    const target = renameTargetRef.current;
    if (target) {
      WebSocketManagerInstance.Send(
        CommandFactory.CreateLayoutUpdateCommand({
          id: target.id,
          gameModelId: gameIdRef.current,
          name: data.name,
        })
      );
    } else {
      const clone = LayoutHelper.GetCloneForSaving(state.ref.current.rootPanel, battlemapsRef);
      WebSocketManagerInstance.Send(
        CommandFactory.CreateLayoutAddCommand({ name: data.name, value: JSON.stringify(clone) })
      );
    }
  };

  const layouts = serverLayouts ?? [];
  const defaultId = layouts.find((l) => l.default)?.id ?? "";
  const collection = React.useMemo(
    () => createListCollection({ items: layouts.map((l) => ({ value: l.id, label: l.name })) }),
    [serverLayouts]
  );

  return (
    <BasePanel>
      <Subscribable commandPrefix="layout_update" onMessage={onLayoutUpdate} />
      <Subscribable commandPrefix="permission_update" onMessage={onPermissionUpdate} />
      <CollectionSyncer
        collection={serverLayouts}
        setCollection={setServerLayouts}
        commandPrefix={"layout"}
        incrementalUpdate={true}
      />

      <Stack p={3} gap={3} overflowY="auto" flex="1">
        <Heading size="md">Layouts</Heading>

        <Box>
          <Text fontSize="xs" color="gray.400" mb={1}>Default layout for new players</Text>
          <SelectRoot
            collection={collection}
            value={defaultId ? [defaultId] : []}
            onValueChange={(e) => e.value[0] && setDefault(e.value[0])}
            size="sm"
          >
            <SelectTrigger>
              <SelectValueText placeholder="No default set">
                {() => layouts.find((l) => l.id === defaultId)?.name ?? "No default set"}
              </SelectValueText>
            </SelectTrigger>
            <SelectContent zIndex={9999}>
              <For each={collection.items}>
                {(o, i) => (
                  <SelectItem key={i} item={o} selected={o.value === defaultId}>
                    {o.label}
                  </SelectItem>
                )}
              </For>
            </SelectContent>
          </SelectRoot>
        </Box>

        <Stack gap={1}>
          {layouts.map((x) => (
            <DListItem key={x.id} isSelected={selectedLayout?.id === x.id}>
              <HStack flex="1" gap={2}>
                <Text>{x.name}</Text>
                {x.default && <Badge size="sm" colorPalette="yellow" variant="subtle">★ default</Badge>}
                {shared[x.id] && <Badge size="sm" colorPalette="blue" variant="subtle">shared</Badge>}
              </HStack>
              <DListItemsButtonContainer>
                <DListItemButton label="Remove" color="red" icon={IoIosRemoveCircleOutline}
                  onClick={() => WebSocketManagerInstance.Send(CommandFactory.CreateLayoutRemoveCommand(x.id))} />
                <DListItemButton label="Advanced / per-player permissions" icon={FaWrench}
                  onClick={() => Dockable.spawnFloating(state, <LayoutSettingsPanel layoutId={x.id} />)} />
                <DListItemButton label={shared[x.id] ? "Stop sharing with players" : "Share with all players"}
                  icon={shared[x.id] ? FaUsers : FaShareAlt} onClick={() => toggleShare(x)} />
                <DListItemButton label="Rename" icon={FaEdit} onClick={() => openRename(x)} />
                <DListItemButton label="Overwrite with current arrangement" icon={FaSave}
                  onClick={() => overwriteWithCurrent(x)} />
                <DListItemButton label="Force onto other players" icon={FaUserFriends}
                  onClick={() => {
                    WebSocketManagerInstance.Send(CommandFactory.CreateLayoutForceCommand(x.id));
                    toaster.create({ title: "Layout forced onto players", type: "success", duration: 3000 });
                  }} />
                <DListItemButton label="Apply this layout" icon={FaCheck} onClick={() => applyLayout(x)} />
              </DListItemsButtonContainer>
            </DListItem>
          ))}
          {serverLayouts !== undefined && layouts.length === 0 && (
            <Text fontSize="sm" color="gray.500">No saved layouts yet.</Text>
          )}
        </Stack>

        <DListItemButton label="Save current arrangement as a new layout" icon={FaPlus}
          onClick={openSaveAsNew} />
      </Stack>

      <InputModal
        openRef={nameModalRef}
        title={renameTargetRef.current ? "Rename layout" : "Save current layout"}
        getConfigDict={() => [
          { key: "name", required: true, label: "Name", toolTip: "Name of layout.", type: "string" },
        ]}
        onCloseModal={onNameSubmit}
      />
    </BasePanel>
  );
};

export default LayoutsManagerPanel;
