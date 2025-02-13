import React, { useEffect } from "react";
import EditTable from "../../settings/EditTable";
import DContainer from "../../../uiComponents/base/Containers/DContainer";
import useUUID from "../../../uiComponents/hooks/useUUID";
import { For, HStack, Select, Stack, createListCollection } from "@chakra-ui/react";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValueText } from "../../../ui/select";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import {
  FaArrowAltCircleDown,
  FaArrowAltCircleUp,
  FaMinusCircle,
} from "react-icons/fa";

export const ActionStep = ({
  actionId,
  initStep,
  stepDefinitions,
  stepsRef,
  setSteps,
}) => {
  const [step, setStep] = React.useState(initStep);
  const guid = useUUID();

  const MoveUp = () => {
    let newSteps = [...stepsRef.current];
    let foundById = newSteps.find((x) => x.id == step.id);
    let index = newSteps.indexOf(foundById);
    if (index > 0) {
      [newSteps[index - 1], newSteps[index]] = [
        newSteps[index],
        newSteps[index - 1],
      ];
    }
    setSteps(newSteps);
  };

  const MoveDown = () => {
    let newSteps = [...stepsRef.current];
    let foundById = newSteps.find((x) => x.id == step.id);
    let index = newSteps.indexOf(foundById);
    if (index < newSteps.length - 1) {
      [newSteps[index], newSteps[index + 1]] = [
        newSteps[index + 1],
        newSteps[index],
      ];
    }
    setSteps(newSteps);
  };

  const Update = () => {
    let foundById = stepsRef.current.find((x) => x.id == step.id);
    let index = stepsRef.current.indexOf(foundById);

    let newSteps = [...stepsRef.current];
    newSteps[index] = step;
    setSteps(newSteps);
  };

  const Delete = () => {
    let foundById = stepsRef.current.find((x) => x.id == step.id);
    let index = stepsRef.current.indexOf(foundById);

    let newSteps = [...stepsRef.current];
    newSteps.splice(index, 1);
    setSteps(newSteps);
  };

  useEffect(() => {
    Update();
  }, [step]);

  const GenerateStepData = (step) => {
    const stepDefinitionBase = [
      { key: "Label", label: "Label", toolTip: "Label", type: "string" },
      { key: "Comment", label: "Comment", toolTip: "Comment", type: "string" },
    ];

    //Find step type
    const stepDefinition = stepDefinitions.find((x) => x.name == step.Type);
    const stepArguments = stepDefinition?.arguments?.map((argument) => {
      let type = argument.type.toLowerCase() === "jtoken" ? "string" : argument.type.toLowerCase();
      
      return ({
      key: argument.name,
      label: argument.name,
      toolTip: argument.name,
      type: type,
    })});

    const stepContent = stepDefinitionBase.concat(stepArguments);

    return (
      stepDefinition && (
        <>
          <p>{stepDefinition.description}</p>
          <EditTable
            keyBase={actionId + step.id + step.Type}
            dto={step.Data}
            editableKeyLabelDict={stepContent}
            hideSaveButton={true}
            saveOnLeave={true}
            onSave={(dto) => {
              setStep({ ...step, Data: {...step.Data, ...dto} });
            }}
          />
        </>
      )
    );
  };

  const stepDefinitionsCollection = createListCollection({items: stepDefinitions});

  return (
    <DContainer
      key={initStep.id}
      withVisibilityToggle={true}
      title={step?.Data?.Label}
      backgroundColor="rgb(50,50,50)"
      collapsed
    >
      <Stack>
        <HStack>
          <DListItemButton
            label={"Move Up"}
            icon={FaArrowAltCircleUp}
            onClick={MoveUp}
          />
          <DListItemButton
            label={"Move Down"}
            icon={FaArrowAltCircleDown}
            onClick={MoveDown}
          />
          <DListItemButton
            label={"Delete"}
            icon={FaMinusCircle}
            color={"red"}
            onClick={Delete}
          />
        </HStack>

        {/* <SelectRoot
              collection={collection}
              onChange={(element) => setStep({ ...step, Type: element.value })}
            >
              <SelectTrigger>
                <SelectValueText placeholder="Select...">
                  {(items) => {
                    const { name } = items[0];
                    return <>{name}</>;
                  }}
                </SelectValueText>
              </SelectTrigger>
              <SelectContent>
                <For each={stepDefinitionsCollection.items}>
                  {(option, index) => (
                    <SelectItem
                      key={index}
                      selected={dto[key] === option.id}
                      item={option}
                    >
                      {option.label}
                    </SelectItem>
                  )}
                </For>
              </SelectContent>
            </SelectRoot> */}

        <DContainer title={"Data"} withVisibilityToggle={true}>
          {GenerateStepData(step)}
        </DContainer>
      </Stack>
    </DContainer>
  );
};
