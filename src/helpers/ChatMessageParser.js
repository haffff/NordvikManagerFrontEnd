import { Image } from "@chakra-ui/react";
import { ChatTemplateDefintions } from "./chatTemplates/ChatTemplateDefinitions";

export default class ChatMessageParser {
  ParseMessage(message) {
    try {
      // Already a parsed object (e.g. incoming WebSocket data that was pre-parsed)
      if (typeof message === "object" && message !== null && message.type) {
        return this.GenerateMessageComponent(message);
      }

      const parsedMessage = JSON.parse(message);

      if (
        typeof parsedMessage === "object" &&
        parsedMessage !== null &&
        parsedMessage.type
      ) {
        return this.GenerateMessageComponent(parsedMessage);
      }

      return message;
    } catch (e) {
      return typeof message === "string" ? message : JSON.stringify(message);
    }
  }

  GenerateMessageComponent(messageObject) {
    //Check if the messageObject is an object and has a type property
    if (!messageObject || !messageObject.type) {
      throw new Error("Invalid message object");
    }

    let templateContructor = ChatTemplateDefintions[messageObject.type];
    if (templateContructor) {
      return templateContructor({ object: messageObject });
    }
    throw new Error("Invalid message type");
  }
}
