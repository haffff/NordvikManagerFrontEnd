import * as React from "react";
import {
  Flex,
  FormLabel,
  HStack,
  Input,
  Select,
  Checkbox,
  Stack,
  Button,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import DList from "../../../uiComponents/base/List/DList";
import WebSocketManagerInstance from "../../WebSocketManager";
import WebHelper from "../../../../helpers/WebHelper";
import DContainer from "../../../uiComponents/base/Containers/DContainer";
import DropDownButton from "../../../uiComponents/base/DDItems/DropDrownButton";
import CollectionSyncer from "../../../uiComponents/base/CollectionSyncer";
import { ActionStep } from "./ActionStep";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import { ReactTreeList } from "@bartaxyz/react-tree-list";
import { FaCheck, FaCross, FaMinus } from "react-icons/fa";
import { DUIBox } from "../../../uiComponents/base/List/DUIBox";

export const ActionsPanel = ({ state, gameDataRef }) => {
  const [actions, setActions] = React.useState([]);
  const [hooks, setHooks] = React.useState([]);
  const [selectedAction, setSelectedAction] = React.useState(null);
  const [stepDefinitions, setStepDefinitions] = React.useState([]);
  const [search, setSearch] = React.useState("");

  const [steps, setSteps] = React.useState([]);
  const stepsRef = React.useRef(steps);
  stepsRef.current = steps;

  const [treeData, setTreeData] = React.useState([]);

  const Load = async () => {
    let actions = await WebHelper.getAsync("addon/actions");
    setActions(actions);

    let stepDefinitionsWrapped = await WebHelper.getAsync(
      "addon/stepdefinitions"
    );
    setStepDefinitions(stepDefinitionsWrapped.stepDefinitions);

    setHooks(await WebHelper.getAsync("addon/hooks"));
  };

  React.useEffect(() => {
    Load();
  }, []);

  React.useEffect(() => {
    setTreeData(GenerateActionsTree(actions));
  }, [actions, search]);

  const selectItem = async (e) => {
    const response = await WebHelper.getAsync("addon/action?id=" + e.id);
    setSelectedAction(response);
    setSteps(JSON.parse(response.content));
  };

  const HandleStep = (step, index) => {
    return (
      <ActionStep
        key={step.id}
        stepIndex={index}
        initStep={step}
        stepDefinitions={stepDefinitions}
        stepsRef={stepsRef}
        setSteps={setSteps}
        actionId={selectedAction?.id}
      />
    );
  };

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Actions`);

  const GenerateActionsTree = (actions) => {
    //{actions.filter(x => x?.name?.toLowerCase().includes(search.toLowerCase())).map(x => (<DListItem isSelected={selectedAction?.id == x?.id} onClick={() => { selectItem(x) }}><DLabel>{x?.name}</DLabel></DListItem>))}
    const filteredActions = actions.filter((x) =>
      x?.name?.toLowerCase().includes(search.toLowerCase())
    );

    const groupd = Object.groupBy(filteredActions, (x) => x.prefix);

    const treeGroups = Object.keys(groupd).map((x) => ({
      id: x,
      label: x,
      open: treeData.find((y) => y.id === x)?.open || false,
      children: groupd[x].map((y) => ({
        id: y.id,
        label: y.name,
        icon: y.isEnabled ? <FaCheck /> : <FaMinus />,
      })),
    }));
    return treeGroups;
  };

  return (
    <>
      <CollectionSyncer
        commandPrefix={"action"}
        collection={actions}
        setCollection={setActions}
      />
      <Flex overflowY={"auto"} height={"100%"}>
        <DContainer title={"Actions"} width={"300px"} maxWidth={"700px"}>
          <DList
            mainComponent={true}
            withAddButton
            handleAdd={() => {
              WebSocketManagerInstance.Send({
                command: "action_add",
                data: {
                  prefix: "MyPrefix",
                  name: "Name",
                  hook: 0,
                  content: "[]",
                },
              });
            }}
          >
            <Input
              placeholder={"Search"}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ReactTreeList
              onChange={setTreeData}
              onSelected={({ id }) => {
                selectItem({ id });
              }}
              data={treeData}
              draggable={false}
              itemDefaults={{ open: false, arrow: "▸" }}
            />
          </DList>
        </DContainer>
        {selectedAction ? (
          <DUIBox key={selectedAction?.id} padding={"10px"} width={"100%"}>
            <Checkbox
              isChecked={selectedAction?.isEnabled}
              onChange={(e) => {
                setSelectedAction({
                  ...selectedAction,
                  isEnabled: e.target.checked,
                });
              }}
            >
              Enabled
            </Checkbox>
            <Flex gap={"5px"}>
              <Input
                width={"200px"}
                value={selectedAction?.prefix}
                onChange={(e) => {
                  setSelectedAction({
                    ...selectedAction,
                    prefix: e.target.value,
                  });
                }}
              />
              <Input
                value={selectedAction?.name}
                onChange={(e) => {
                  setSelectedAction({
                    ...selectedAction,
                    name: e.target.value,
                  });
                }}
              />
            </Flex>
            <Stack>
              <Input
                value={selectedAction?.description}
                onChange={(e) => {
                  setSelectedAction({
                    ...selectedAction,
                    description: e.target.value,
                  });
                }}
              />
              <Select
                defaultValue={-1}
                value={selectedAction?.hook}
                onChange={(e) => {
                  setSelectedAction({
                    ...selectedAction,
                    hook: e.target.value,
                  });
                }}
              >
                {hooks.map((x) => (
                  <option value={x.value}>{x.name}</option>
                ))}
              </Select>

              <DContainer title={"Steps"} withVisibilityToggle={true}>
                <DList
                  gap={"10px"}
                  mainComponent={true}
                  withAddButton
                  handleAdd={() =>
                    setSteps([
                      ...stepsRef.current,
                      {
                        id: UtilityHelper.GenerateUUID(),
                        Data: { Label: "Step" },
                        Type: "SetVariable",
                      },
                    ])
                  }
                >
                  {stepsRef.current?.map((x, i) => HandleStep(x, i)) || []}
                </DList>
              </DContainer>
            </Stack>
            <HStack gap={"10px"}>
              <Button
                onClick={() => {
                  selectedAction.content = JSON.stringify(stepsRef.current);
                  WebSocketManagerInstance.Send({
                    command: "action_update",
                    data: selectedAction,
                  });
                }}
              >
                Update
              </Button>
              <Button
                onClick={() => {
                  selectedAction.content = JSON.stringify(stepsRef.current);
                  WebSocketManagerInstance.Send({
                    command: "action_delete",
                    data: selectedAction.id,
                  });
                }}
              >
                Delete
              </Button>
              <Button
                onClick={() => {
                  let selectedActionNew = {
                    ...selectedAction,
                    hook: parseInt(selectedAction.hook),
                  };
                  let serialized = JSON.stringify(selectedActionNew, null, 2);
                  var element = document.createElement("a");
                  element.setAttribute(
                    "href",
                    "data:text/plain;charset=utf-8," +
                      encodeURIComponent(serialized)
                  );
                  element.setAttribute(
                    "download",
                    selectedAction.name + ".json"
                  );
                  element.style.display = "none";
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                }}
              >
                Export
              </Button>
            </HStack>
          </DUIBox>
        ) : (
          <></>
        )}
      </Flex>
    </>
  );
};
export default ActionsPanel;
