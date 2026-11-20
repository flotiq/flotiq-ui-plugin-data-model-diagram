/**
 * Layout persistence.
 *  - local: localStorage, per browser + space, saved automatically on every change;
 *  - team:  `layout` key inside this plugin's settings JSON (the `_plugin_settings` content object whose id is
 *           the plugin id — same object Flotiq's "Manage" modal writes). Saved explicitly ("Save layout").
 *
 * Layout shape: { positions: { [ctdName]: {x, y} }, hidden: string[], savedAt }
 */

const localKey = (pluginId) => {
  const space =
    window.location.pathname.match(/^\/s\/([^/]+)/)?.[1] || 'default';
  return `${pluginId}:layout:${space}`;
};

const parseJson = (text) => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

export function readLocalLayout(pluginId) {
  try {
    return parseJson(localStorage.getItem(localKey(pluginId)));
  } catch {
    return null;
  }
}

export function writeLocalLayout(pluginId, layout) {
  try {
    localStorage.setItem(
      localKey(pluginId),
      JSON.stringify({ ...layout, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* storage unavailable (private mode, quota) — layout lives for this session only */
  }
}

export function clearLocalLayout(pluginId) {
  try {
    localStorage.removeItem(localKey(pluginId));
  } catch {
    /* ignore */
  }
}

export function readTeamLayout(globals) {
  const settings = parseJson(globals?.getPluginSettings?.());
  return settings?.layout || null;
}

/**
 * Merge the layout into the plugin's settings JSON (other keys are preserved) and PATCH the
 * `_plugin_settings` object. Throws a user-readable Error on failure.
 */
export async function saveTeamLayout(client, globals, pluginId, layout) {
  const settings = parseJson(globals?.getPluginSettings?.()) || {};
  const next = JSON.stringify({
    ...settings,
    layout: { ...layout, savedAt: new Date().toISOString() },
  });
  let response;
  try {
    response = await client._plugin_settings.patch(pluginId, {
      settings: next,
    });
  } catch (error) {
    throw new Error(`Can't save the layout: ${error?.message || error}`);
  }
  if (response && response.ok === false) {
    const reason =
      response.status === 404
        ? 'the plugin is not installed in this space (temporary loadPlugin has no settings object)'
        : response.status === 403
          ? 'you have no permission to change plugin settings'
          : `HTTP ${response.status}`;
    throw new Error(`Can't save the layout: ${reason}`);
  }
  globals?.setPluginSettings?.(next);
}
