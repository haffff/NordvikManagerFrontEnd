/**
 * Adds feature modules to a mediator client class. A feature is
 * { meta: { Command: description... }, methods: { Command() {...}, _helper() {...} } };
 * its methods run on the instance, so they share `this` with the class and each other.
 *
 * On the prototype and in $meta, because CommandExecutionHelper.LoadSuggestions reads them
 * there for the Run dialog and keyboard bindings.
 */
export function installFeatures(Service, ownMeta, features) {
  const meta = { ...ownMeta };
  for (const feature of features) {
    for (const [name, method] of Object.entries(feature.methods)) {
      if (Object.hasOwn(Service.prototype, name)) throw new Error(`${Service.name}: ${name} is defined twice`);
      Service.prototype[name] = method;
    }
    for (const [name, description] of Object.entries(feature.meta)) {
      if (Object.hasOwn(meta, name)) throw new Error(`${Service.name}: ${name} is described twice`);
      meta[name] = description;
    }
  }
  Object.defineProperty(Service.prototype, "$meta", { get: () => meta });
}
