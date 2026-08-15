/**
 * dsh-liquid-glass — Host half.
 *
 * This plugin is browser-only: all styling, painting and the settings UI live
 * in `./client.js` (the `dsh.client` bundle served by the web surface).
 * The host half intentionally provides no behavior; it exists so the profile
 * Loader can mount the row and the client-modules scanner can compose the
 * browser roster entry.
 */
/** Host loader entry for the browser-only liquid-glass plugin. */
function apply() {}

export { apply };
