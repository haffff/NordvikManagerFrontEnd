import { Image } from "@chakra-ui/react";
import { RollChatTemplate } from "./RollChatTemplate";

export const ChatTemplateDefintions = {
    "Image": (props) => <Image {...props} />,
    "Roll": (props) => <RollChatTemplate {...props} />,
}