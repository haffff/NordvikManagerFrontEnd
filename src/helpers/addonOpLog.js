// Start-to-end trace of addon install/uninstall operations in the browser console.
// Filter the console by "[AddonOp]" to follow one operation; the backend console uses
// the same tag (category "AddonOp").
export const isAddonOpPath = (path) => /(^|\/)addon\//i.test(path ?? '');

export default function addonOpLog(...args) {
  // eslint-disable-next-line no-console
  console.info('[AddonOp]', new Date().toISOString().slice(11, 23), ...args);
}
