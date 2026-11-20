import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';

const PADDING = 40;
const MAX_SIDE = 8000;

/**
 * html-to-image does not copy computed styles onto SVG children (edge paths, arrow markers), so their
 * CSS-driven stroke/fill would be lost. Bake the computed values into attributes for the export.
 * @returns restore function
 */
function bakeSvgStyles(rootElement) {
  const changed = [];
  rootElement
    .querySelectorAll(
      '.react-flow__edge-path, .react-flow__arrowhead polyline, .react-flow__edge-textbg',
    )
    .forEach((el) => {
      const cs = getComputedStyle(el);
      const attrs = {
        stroke: cs.stroke,
        'stroke-width': cs.strokeWidth,
        fill: cs.fill,
        opacity: cs.opacity,
      };
      const previous = Object.fromEntries(
        Object.keys(attrs).map((k) => [k, el.getAttribute(k)]),
      );
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      changed.push([el, previous]);
    });
  return () =>
    changed.forEach(([el, previous]) =>
      Object.entries(previous).forEach(([k, v]) =>
        v === null ? el.removeAttribute(k) : el.setAttribute(k, v),
      ),
    );
}

/** Render the whole (visible) diagram — not just what is on screen — as PNG or SVG data URL. */
async function renderImage(rootElement, nodes, format) {
  const viewportElement = rootElement.querySelector('.react-flow__viewport');
  const visible = nodes.filter((n) => !n.hidden);
  if (!viewportElement || !visible.length) throw new Error('Nothing to export');

  const bounds = getNodesBounds(visible);
  const scale = Math.min(2, MAX_SIDE / Math.max(bounds.width, bounds.height));
  const width = Math.ceil((bounds.width + 2 * PADDING) * scale);
  const height = Math.ceil((bounds.height + 2 * PADDING) * scale);
  const viewport = getViewportForBounds(
    bounds,
    width,
    height,
    scale,
    scale,
    PADDING / bounds.width,
  );
  const background =
    getComputedStyle(rootElement).getPropertyValue('--fq-surface').trim() ||
    '#ffffff';

  const render = format === 'svg' ? toSvg : toPng;
  const restore = bakeSvgStyles(rootElement);
  try {
    return await render(viewportElement, {
      backgroundColor: background,
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
      // interactive bits that make no sense on paper
      filter: (node) => !node.classList?.contains('fq-node__hide'),
    });
  } finally {
    restore();
  }
}

const download = (dataUrl, fileName) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.click();
};

export async function exportImage(rootElement, nodes, format) {
  const dataUrl = await renderImage(rootElement, nodes, format);
  download(dataUrl, `data-model.${format}`);
}

/** Print via a hidden iframe (no popup → not blocked). */
export async function printDiagram(rootElement, nodes) {
  const dataUrl = await renderImage(rootElement, nodes, 'png');
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.append(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(
    '<!doctype html><title>Data model</title><style>@page{margin:10mm}html,body{margin:0}' +
      'img{width:100%;height:auto;display:block}</style>' +
      `<img src="${dataUrl}">`,
  );
  doc.close();
  const img = doc.querySelector('img');
  await (img.complete
    ? Promise.resolve()
    : new Promise((resolve) => (img.onload = resolve)));
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(() => iframe.remove(), 1000);
}
