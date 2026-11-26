<a href="https://flotiq.com/">
    <img src="https://editor.flotiq.com/fonts/fq-logo.svg" alt="Flotiq logo" title="Flotiq" align="right" height="60" />
</a>

# Data model diagram — Flotiq UI plugin

An interactive diagram of your Flotiq **Content Type Definitions**, their **fields** and **relations**, on its own page,
opened from the Flotiq sidebar.

![Data model diagram](docs/screenshot.png)

## Features

- **Every content type as a card** with its fields: types, relation targets (`→ author`, `→ category[]` for multiple),
  `req` / `UK` / `T` badges (required, unique, title field). Nested list fields are shown indented.
- **Relations as edges**, drawn from the relation field to the target type. Hover a card to highlight its relations.
- **Object counts** per type. Click the count to open the objects, click the title to open the definition.
- **Layout:** drag cards, **Auto layout** (ELK), zoom / fit view, minimap, fullscreen.
- **Hide types** with the × on a card or with the list on the left. **Search** across type and field names.
- **Remember the layout:** your changes are kept in your browser automatically. **Save layout** stores positions and
  hidden types in the plugin settings for everyone in the space, **Load layout** brings them back, **Reset** shows all
  types and arranges them again.
- **Export** the whole diagram to PNG or SVG, or print it.
- Flotiq look and feel (editor design tokens and font), including **dark mode**.
- ⚙ in the toolbar opens Plugins, where **Manage** shows a description of the plugin and the saved layout:

  <img src="docs/settings.png" alt="Plugin settings" width="520" />

## Installation

1. In Flotiq, go to **Plugins** and find the **Custom plugin** field.
2. Paste the manifest URL and add the plugin:

   ```
   https://plugins.flotiq.com/files/flotiq.data-model-diagram/0.4.0/plugin-manifest.json
   ```

   The package is served by the Flotiq plugin marketplace (`plugins.flotiq.com`, one of the editor's allowed plugin
   hosts). It is deployed there as a draft, so it is not listed in the plugin library.

3. Click **Data model** in the sidebar, below **Plugins**. The diagram opens as a separate page
   (`/s/<space>/plugins/flotiq.data-model-diagram/data-model`).

Version 0.4.0 needs an editor with plugin sidebar pages (`flotiq.sidebar.menu-item::add`). In an older editor use
0.3.2, which shows the diagram as a dashboard section:
`https://plugins.flotiq.com/files/flotiq.data-model-diagram/0.3.2/plugin-manifest.json`.

### Permissions

| Permission                             | Why                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `CTD` `*` — read                       | Read the content type definitions.                                         |
| `CO` `*` — read                        | Object counts (`list({ limit: 1 })` → `total_count`). Shows `–` if denied. |
| `CO` `_plugin_settings` — read, update | **Save layout** (stored under `layout` in this plugin's settings).         |

Saving a layout needs a user who may edit plugin settings, and the plugin has to be installed in the space. A plugin
loaded temporarily with `FlotiqPlugins.loadPlugin` has no settings object to save to.

## Development

```bash
yarn          # install
yarn start    # watch mode, serves https://localhost:3053/index.js and /plugin-manifest.json
yarn build    # production bundle in dist/ (index.js + plugin-manifest.json)
yarn lint     # eslint (also runs as part of the build)
yarn format   # prettier
```

Accept the self-signed certificate by opening `https://localhost:3053/index.js` in the browser first. Then either:

- load it temporarily in the Flotiq editor console:
  `FlotiqPlugins.loadPlugin('flotiq.data-model-diagram', 'https://localhost:3053/index.js')`, or
- install it from `https://localhost:3053/plugin-manifest.json`. In watch mode the served manifest points at the
  local bundle.

### How it works

- Placement: `flotiq.sidebar.menu-item::add` adds the **Data model** item, `flotiq.plugin.page::render` renders the
  page (`pageId` `data-model`). The settings screen uses `flotiq.plugins.manage::render`.
- Stack: React 19, [React Flow](https://reactflow.dev) (`@xyflow/react` 12), [ELK](https://eclipse.dev/elk/) for
  auto layout, `html-to-image` for export. esbuild bundles everything into a single `dist/index.js` with the CSS
  inlined, because Flotiq loads only the JS file.
- Styling: `plugins/styles/style.css` maps everything to the editor's CSS design tokens (`--color-*`), so light and
  dark mode follow the editor.

```
plugins/
  index.jsx                 registration, CSS injection, sidebar item and page, settings screen
  components/
    DiagramApp.jsx          state, layout, toolbar actions (toolbar is a declarative list of groups)
    EntityNode.jsx          content type card
    Sidebar.jsx             search + show/hide list
    Toolbar.jsx
    SettingsPanel.jsx       "Manage" modal content
  data-model/
    model.js                CTD JSON → entities, fields, relations
    api.js                  content types + object counts
    layout.js               ELK auto layout
    storage.js              local + shared layout
    export.js               PNG / SVG / print
```

## Releases

Every push to `main` builds the plugin and creates a GitHub release with a `<version>.tar.gz` package, tagged with
the manifest version. The production manifest's `url` is
`https://plugins.flotiq.com/files/<id>/<version>/index.js` (set by `esbuild.config.js`).

To ship a version, set **Plugin version package URL** of the plugin's object in the marketplace space to
`https://github.com/trzcina/flotiq-ui-plugin-data-model-diagram/releases/download/<version>/<version>.tar.gz` and
save it as a draft. Do not publish it or tick **Is system plugin**. Both would make the plugin available to every
Flotiq account.

`dist/` is also deployed to GitHub Pages, but the editor only loads plugins from allowed hosts, so that copy is not
used for installation.

Bump `version` in **both** `package.json` and `plugin-manifest.json` and add a `CHANGELOG.md` entry. Pull requests
check this.

## License

[MIT](LICENSE.txt). Based on the [Flotiq plain JS plugin template](https://github.com/flotiq/flotiq-ui-plugin-templates-plain-js).
