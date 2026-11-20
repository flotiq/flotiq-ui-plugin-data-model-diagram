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

  handler.on('flotiq.dashboard.section::add', () => {
    const cacheKey = `${pluginInfo.id}-dashboard`;
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
      // unmount when the dashboard goes away for good (detach not followed by re-attach)
      addElementToCache(element, cacheKey, {}, () => root.unmount());
    }
    return {
      id: `${pluginInfo.id}-data-model`,
      label: 'Data model diagram',
      content: element,
      visible: true,
    };
  });
});
