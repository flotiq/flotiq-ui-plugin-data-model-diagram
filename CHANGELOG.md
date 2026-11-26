# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-11-26

### Changed

- The diagram moved from the dashboard to its own page: **Data model** in the sidebar, below Plugins
  (`flotiq.sidebar.menu-item::add` and `flotiq.plugin.page::render`). The diagram fills the page height.
- Dependencies: chalk 6.0.1, elkjs 0.12.1, postcss 8.5.33, eslint-config-prettier 10.1.8,
  eslint-plugin-react-hooks 7.1.1 (two fixes in `DiagramApp.jsx` for its new `set-state-in-effect` and `use-memo` rules).
- Repository links point at `github.com/flotiq/flotiq-ui-plugin-data-model-diagram`.
- Requires an editor with plugin sidebar pages. In an older editor the plugin shows nothing, so stay on 0.3.2 there.

## [0.3.2] - 2026-11-23

### Changed

- Release on the marketplace after the worker started serving `plugin-manifest.json` as `application/json`
  (the cached 0.3.1 manifest is still served without a content type). No code changes.

## [0.3.1] - 2026-11-23

### Changed

- The production manifest `url` points at the Flotiq plugin marketplace
  (`https://plugins.flotiq.com/files/flotiq.data-model-diagram/<version>/index.js`). GitHub Pages is not an allowed
  plugin host in the editor.

## [0.3.0] - 2026-11-20

### Added

- Plugin settings ("Manage" in Plugins): description, saved layout info, "Remove saved layout".
- ⚙ toolbar button opening the Plugins page.
- GitHub Pages deployment and GitHub release on every push to `main`.

### Changed

- Plugin id `flotiq.data-model-diagram`, production URL on GitHub Pages; in watch mode the served manifest points at
  `https://localhost:3053/index.js`.
- "Auto layout" is a single button (horizontal layout only).

## [0.2.0] - 2026-11-20

### Changed

- Simpler toolbar: "Save layout" / "Load layout" (plugin settings, shared in the space) / "Reset", "Export" menu
  (PNG, SVG, print), refresh and fullscreen icons. Fit view lives in the canvas controls.

## [0.1.0] - 2026-11-20

### Added

- Interactive data model diagram (React Flow + ELK) on the dashboard: drag, auto layout, hide/show, search, object
  counts, PNG/SVG/print export, local + shared layout persistence, Flotiq look with dark mode.
