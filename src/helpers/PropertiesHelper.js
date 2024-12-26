import WebSocketManagerInstance from "../components/game/WebSocketManager";
import UtilityHelper from "./UtilityHelper";
import WebHelper from "./WebHelper";

class PropertiesHelper {
  panel = "properties";
  id = "PropertiesHelper";

  _propertyCache = {};

  constructor() {
    WebSocketManagerInstance.Subscribe("PropertiesHelper_subs", (command) => {
      if (command.command === "property_update") {
        this._propertyCache[command.data.id] = command.data;
      }
      if (command.command === "property_add") {
        this._propertyCache[command.data.id] = command.data;
      }
      if (command.command === "property_delete") {
        delete this._propertyCache[command.data];
      }
    });
  }

  async Get({ parentId, isCommand }) {
    if (isCommand && !parentId) {
      return "--parentId is required";
    }

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}`
    );

    properties?.forEach((x) => {
      this._propertyCache[x.id] = x;
    });

    return properties;
  }

  async AddToCache({ properties, isCommand }) {
    if (isCommand && !properties) {
      return "--properties is required, since its complex object type this command is not supported (for now)";
    }

    properties.forEach((x) => {
      this._propertyCache[x.id] = x;
    });
  }

  async LoadToCache({ parentId, isCommand }) {
    if (isCommand && !parentId) {
      return "--parentId is required";
    }

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}`
    );

    properties?.forEach((x) => {
      this._propertyCache[x.id] = x;
    });
  }

  async GetByNames({ parentId, names, isCommand }) {
    if (isCommand && (!parentId || !names)) {
      return "--parentId and --names are required";
    }

    if(!parentId)
    {
      console.error("parentId is required");
      return [];
    }

    let namesVar = names;

    if (!Array.isArray(namesVar)) {
      namesVar = namesVar.split(",");
    }

    //Check cache
    const cachedProperties = [];
    namesVar.forEach((name) => {
      let found = Object.values(this._propertyCache).find(
        (x) => x.name === name && x.parentID === parentId
      );
      if (found) {
        cachedProperties.push(found);
      }
    });

    if (cachedProperties.length === namesVar.length) {
      return cachedProperties;
    }

    // find still missing properties
    const missingNames = namesVar.filter(
      (x) => cachedProperties.findIndex((y) => y.name === x) === -1
    );

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}&names=${missingNames.join(
        ","
      )}`
    );

    //add caching
    properties?.forEach((x) => {
      this._propertyCache[x.id] = x;
    });

    //merge properties with cachedproperties
    const mergedProperties = [...cachedProperties, ...properties];

    return mergedProperties;
  }

  async GetByPrefix({ parentId, prefix, getFromCache, isCommand }) {
    if (isCommand && !parentId) {
      return "--parentId is required";
    }

    if (getFromCache) {
      return Object.values(this._propertyCache).filter(
        (x) => x.parentID === parentId && x.name.startsWith(prefix)
      );
    }

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}&prefix=${prefix}`
    );

    properties?.forEach((x) => {
      this._propertyCache[x.id] = x;
    });

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

    //Check cache
    const cachedProperties = [];
    idsVar.forEach((id) => {
      if (this._propertyCache[id]) {
        cachedProperties.push(this._propertyCache[id]);
      }
    });

    if (cachedProperties.length === idsVar.length) {
      return cachedProperties;
    }

    // find still missing properties

    const missingIds = idsVar.filter((x) => !this._propertyCache[x]);

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}&ids=${missingIds.join(
        ","
      )}`
    );
    //add caching
    properties?.forEach((x) => {
      this._propertyCache[x.id] = x;
    });

    //merge properties with cachedproperties
    const mergedProperties = [...cachedProperties, ...properties];
    return mergedProperties;
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

      finalProperty = { ...finalProperty, value: propertyValue };
    }

    WebSocketManagerInstance.Send({
      command: "property_update",
      data: finalProperty,
    });
  }

  async UpdateBulk({ properties, isCommand }) {
    if (isCommand && !properties) {
      return "--properties is required, since its complex object type this command is not supported (for now)";
    }

    await WebHelper.postAsync(`properties/UpdateBulk`, properties);

    //update cache
    properties.forEach((x) => {
      this._propertyCache[x.id] = x;
    });

    WebSocketManagerInstance.Send({
      command: "property_notify",
      data: { id: properties[0].parentID },
    });
  }

  async Add({ property, isCommand, parentId, name, value, entityName }) {
    if (isCommand && (!parentId || !name || !value || !entityName)) {
      return "--parentId --name --value and --entityType are required";
    }

    if (isCommand) {
      property = { parentId, name, value, entityName };
    }

    WebSocketManagerInstance.Send({
      command: "property_add",
      data: property,
    });
  }

  async AddMany({ properties, isCommand }) {
    if (isCommand && !properties) {
      return "--properties is required, since its complex object type this command is not supported (for now)";
    }

    await WebHelper.postAsync(`properties/AddMany`, properties);

    //update cache
    properties.forEach((x) => {
      this._propertyCache[x.id] = x;
    });

    WebSocketManagerInstance.Send({ command: "property_notify" });
  }
}

const PropertiesHelperInstance = new PropertiesHelper();

export default PropertiesHelperInstance;
