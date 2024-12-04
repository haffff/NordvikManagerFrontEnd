import WebSocketManagerInstance from "../components/game/WebSocketManager";
import WebHelper from "./WebHelper";

class PropertiesHelper {
  panel = "properties";
  id = "PropertiesHelper";

  async Get({ parentId, isCommand }) {
    if (isCommand && !parentId) {
      return "--parentId is required";
    }

    const properties = await WebHelper.getAsync(`properties/QueryProperties?parentIds=${parentId}`);
    //add caching
    return properties;
  }

  async GetByNames({ parentId, names, isCommand }) {
    if (isCommand && (!parentId || !names)) {
      return "--parentId and --names are required";
    }

    let namesVar = names;

    if (Array.isArray(namesVar)) {
      namesVar = namesVar.join(",");
    }

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}&names=${namesVar}`
    );
    //add caching
    return properties;
  }

  async GetByIds({ parentId, ids, isCommand }) {
    if (isCommand && (!parentId || !ids)) {
      return "--parentId and --ids are required";
    }

    let idsVar = ids;

    if (Array.isArray(idsVar)) {
      idsVar = idsVar.join(",");
    }

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}&ids=${ids.join(",")}`
    );
    //add caching
    return properties;
  }

  async Update({
    property,
    isCommand,
    propertyName,
    propertyValue,
    propertyId,
    parentId,
  }) {
    if (isCommand && (!propertyId || (!propertyName && !parentId))) {
      return "either --propertyId or --propertyName and --parentId are required";
    }

    let finalProperty = property;
    if (!finalProperty) {
      if (propertyId === undefined) {
        finalProperty = await this.GetByNames({
          parentId,
          names: propertyName,
        });
      } else {
        finalProperty = { id: propertyId };
      }
    }

    finalProperty = { ...finalProperty, value: propertyValue };

    WebSocketManagerInstance.Send({
      command: "property_update",
      data: finalProperty,
    });
  }

  async UpdateBulk({properties, isCommand}) {
    if(isCommand && !properties) {
      return "--properties is required, since its complex object type this command is not supported (for now)";
    }

    await WebHelper.postAsync(`properties/UpdateBulk`, properties);

    WebSocketManagerInstance.Send({command: "property_notify"})
  }
}

const PropertiesHelperInstance = new PropertiesHelper();

export default PropertiesHelperInstance;
