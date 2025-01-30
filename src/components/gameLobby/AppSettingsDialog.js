import * as React from "react";
import {
  Stack,
  Heading,
  Input,
  InputGroup,
  InputRightElement,
  Button,
  Modal,
  ModalBody,
  useDisclosure,
  ModalHeader,
  ModalOverlay,
  ModalContent,
  Checkbox,
  ButtonGroup,
  Box,
  Wrap,
  WrapItem,
  HStack,
  ModalFooter,
  Image,
  Flex,
  Textarea,
} from "@chakra-ui/react";
import WebHelper from "../../helpers/WebHelper";
import { FaLink } from "react-icons/fa";
import DContainer from "../uiComponents/base/Containers/DContainer";

export const AppSettingsDialog = ({ OnSuccess, openRef }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [recommendedAddons, setRecommendedAddons] = React.useState([]);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    passwordRequired: false,
  });

  openRef.current = onOpen;

  React.useEffect(() => {
    
  }, []);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size={"5xl"}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Application Settings</ModalHeader>
          <ModalBody>
            <form onSubmit={() => {}}></form>
            <ModalFooter>
              <ButtonGroup>
                <Button onClick={onClose}>Cancel</Button>
              </ButtonGroup>
            </ModalFooter>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};
