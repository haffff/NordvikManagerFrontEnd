import { RollChatTemplate } from "./RollChatTemplate";
import { GenericChatTemplate } from "./GenericChatTemplate";
import { HtmlChatTemplate } from "./HtmlChatTemplate";

export const ChatTemplateDefintions = {
    "Roll": (props) => <RollChatTemplate {...props} />,
    "Generic": (props) => <GenericChatTemplate {...props} />,
    "Html": (props) => <HtmlChatTemplate {...props} />
}