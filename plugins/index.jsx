import { createRoot } from 'react-dom/client';
import {
  addElementToCache,
  getCachedElement,
  registerFn,
} from '../common/plugin-element-cache';
import pluginInfo from '../plugin-manifest.json';
import xyflowCss from 'inline:../node_modules/@xyflow/react/dist/style.css';
import cssString from 'inline:./styles/style.css';
import DiagramApp from './components/DiagramApp';
import SettingsPanel from './components/SettingsPanel';

const PAGE_ID = 'data-model';

// Sidebar icon: three linked boxes, drawn in the sidebar's text color.
const createIcon = () => {
  const icon = document.createElement('span');
  icon.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="3" width="7" height="6" rx="1.5"/>' +
    '<rect x="8.5" y="15" width="7" height="6" rx="1.5"/><path d="M10 6h4M6.5 9v3h11V9M12 12v3"/></svg>';
  icon.style.display = 'flex';
  return icon;
};

const injectStyles = () => {
  if (document.getElementById(`${pluginInfo.id}-styles`)) return;
  const style = document.createElement('style');
  style.id = `${pluginInfo.id}-styles`;
  style.textContent = `${xyflowCss}\n${cssString}`;
  document.head.appendChild(style);
};

registerFn(pluginInfo, (handler, client, globals) => {
  injectStyles();

  // "Manage" modal in Plugins: description + saved layout management.
  handler.on(
    'flotiq.plugins.manage::render',
    ({ plugin, updateSettings, modalInstance }) => {
      const element = document.createElement('div');
      const root = createRoot(element);
      root.render(
        <SettingsPanel
          plugin={plugin}
          pluginInfo={pluginInfo}
          updateSettings={updateSettings}
          close={() => modalInstance?.resolve?.()}
        />,
      );
      element.addEventListener('flotiq.detached', () =>
        setTimeout(() => !element.isConnected && root.unmount(), 50),
      );
      return element;
    },
  );

  // Sidebar item below "Plugins". It opens /s/:space/plugins/<plugin id>/data-model.
  handler.on('flotiq.sidebar.menu-item::add', () => ({
    id: PAGE_ID,
    title: 'Data model',
    icon: createIcon(),
  }));

  handler.on('flotiq.plugin.page::render', ({ pageId }) => {
    if (pageId !== PAGE_ID) return null;

    const cacheKey = `${pluginInfo.id}-page`;
    let element = getCachedElement(cacheKey)?.element;
    if (!element) {
      element = document.createElement('div');
      const root = createRoot(element);
      root.render(
        <DiagramApp
          client={client}
          globals={globals}
          pluginInfo={pluginInfo}
        />,
      );
      // unmount when the page goes away for good (detach not followed by re-attach)
      addElementToCache(element, cacheKey, {}, () => root.unmount());
    }
    return element;
  });
});
