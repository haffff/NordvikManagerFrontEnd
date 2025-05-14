import { Image } from "@chakra-ui/react";
import { ChatTemplateDefintions } from "./chatTemplates/ChatTemplateDefinitions";

export default class ChatMessageParser {
  ParseMessage(message) {
    //Try parse json
    try {
      const parsedMessage = JSON.parse(message);

      //Check if the parsed message is an object and has a type property
      if (
        typeof parsedMessage === "object" &&
        parsedMessage !== null &&
        parsedMessage.type
      ) {
        return this.GenerateMessageComponent(parsedMessage);
      }

      return message;
    } catch (e) {
      //If parsing fails, return the original message
      return message;
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
