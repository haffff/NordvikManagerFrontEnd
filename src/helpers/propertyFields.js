// Settings fields stored as properties (`property: true`) rather than on the dto.
// A field usually keeps its value in the property named after its key. One choice
// can also span several properties: it lists them in `propertyNames`, reads them
// with `fromProperties(get)` and writes them with `toProperties(value)` → {name: value}
// (e.g. a token element's Visible / GM only / Hidden, kept as two flags).

const isPropertyField = (editable) => !!editable.property;

/** The names of every property behind the given fields. */
export const propertyNamesOf = (editables) =>
  editables.filter(isPropertyField).flatMap((e) => e.propertyNames ?? [e.key]);

/** Each property field's value, read from the stored property rows ({name, value}). */
export const readPropertyFields = (editables, rows) => {
  const get = (name) => (rows ?? []).find((r) => r.name === name)?.value;
  const values = {};
  editables.filter(isPropertyField).forEach((editable) => {
    if (editable.fromProperties) {
      values[editable.key] = editable.fromProperties(get);
      return;
    }
    let value = get(editable.key);
    if (editable.type === "number") value = parseFloat(value);
    if (editable.type === "boolean") value = value === "true" || value === true || value === "True";
    // A field can read the stored string itself (e.g. into one of its options).
    if (editable.parse) value = editable.parse(value);
    values[editable.key] = value;
  });
  return values;
};

/**
 * Splits changed values into the properties to store ({name: value}, a field spanning
 * several properties written out into each of them) and the rest (dto fields).
 */
export const splitPropertyValues = (editables, changed) => {
  const properties = {};
  const rest = {};
  Object.entries(changed).forEach(([key, value]) => {
    const editable = editables.find((e) => e.key === key);
    if (!editable || !isPropertyField(editable)) {
      rest[key] = value;
    } else if (editable.toProperties) {
      Object.assign(properties, editable.toProperties(value));
    } else {
      properties[key] = value;
    }
  });
  return { properties, rest };
};
