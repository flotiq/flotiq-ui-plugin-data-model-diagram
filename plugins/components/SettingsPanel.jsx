import { useState } from 'react';

const parseSettings = (text) => {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
};

/**
 * Content of the plugin's "Manage" modal (flotiq.plugins.manage::render):
 * what the plugin does, where to find it, and the layout saved with "Save layout".
 */
export default function SettingsPanel({
  plugin,
  pluginInfo,
  updateSettings,
  close,
}) {
  const [settings, setSettings] = useState(() =>
    parseSettings(plugin?.settings),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const layout = settings.layout;

  const clearLayout = async () => {
    setBusy(true);
    setMessage('');
    // eslint-disable-next-line no-unused-vars
    const { layout: _removed, ...rest } = settings;
    try {
      const [saved, errors] = await updateSettings(JSON.stringify(rest));
      if (errors && Object.keys(errors).length)
        throw new Error(Object.values(errors).flat().join(', '));
      setSettings(parseSettings(saved));
      setMessage('Saved layout removed.');
    } catch (e) {
      setMessage(`Could not remove the layout: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fq-dm fq-settings">
      <p>{pluginInfo.description}</p>

      <h3>Where to find it</h3>
      <p>
        Open the <strong>Dashboard</strong> — the diagram is the{' '}
        <strong>“Data model diagram”</strong> section. You can reorder or hide
        it in the dashboard’s edit mode.
      </p>

      <h3>What you can do</h3>
      <ul>
        <li>
          Drag types around, use “Auto layout”, hide types (× or the list),
          search types and fields.
        </li>
        <li>
          Click a type title to open its definition, the counter to open its
          objects.
        </li>
        <li>Export the whole diagram to PNG / SVG or print it.</li>
        <li>
          Your changes are kept in this browser automatically. “Save layout”
          stores them in these plugin settings for everyone in the space; “Load
          layout” brings them back.
        </li>
      </ul>

      <h3>Saved layout</h3>
      {layout ? (
        <p>
          Saved{' '}
          {layout.savedAt ? new Date(layout.savedAt).toLocaleString() : ''} ·{' '}
          {Object.keys(layout.positions || {}).length} positions ·{' '}
          {(layout.hidden || []).length} hidden types
        </p>
      ) : (
        <p className="fq-settings__muted">No layout saved yet.</p>
      )}

      <div className="fq-settings__actions">
        <button
          type="button"
          className="fq-btn"
          onClick={clearLayout}
          disabled={!layout || busy}
        >
          Remove saved layout
        </button>
        <button type="button" className="fq-btn" onClick={close}>
          Close
        </button>
        {message && <span className="fq-settings__muted">{message}</span>}
      </div>

      <p className="fq-settings__muted">
        Version {pluginInfo.version}
        {pluginInfo.repository && (
          <>
            {' · '}
            <a href={pluginInfo.repository} target="_blank" rel="noreferrer">
              {pluginInfo.repository.replace(/^https?:\/\//, '')}
            </a>
          </>
        )}
      </p>
    </div>
  );
}
