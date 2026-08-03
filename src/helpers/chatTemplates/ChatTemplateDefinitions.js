import { Image } from "@chakra-ui/react";
import { RollChatTemplate } from "./RollChatTemplate";
import { GenericChatTemplate } from "./GenericChatTemplate";

export const ChatTemplateDefintions = {
    "Image": (props) => <Image {...props} />,
    "Roll": (props) => <RollChatTemplate {...props} />,
    "Generic": (props) => <GenericChatTemplate {...props} />
}