import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

const FALLBACK_SIZE = { width: 260, height: 120 };

/**
 * Auto-layout with ELK (layered). Uses measured node sizes when React Flow has them.
 * @returns {Promise<Map<string, {x:number, y:number}>>}
 */
export async function computeLayout(nodes, edges) {
  const visible = nodes.filter((n) => !n.hidden);
  const ids = new Set(visible.map((n) => n.id));
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '40',
      'elk.spacing.componentComponent': '60',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: visible.map((n) => ({
      id: n.id,
      width: n.measured?.width ?? n.width ?? FALLBACK_SIZE.width,
      height: n.measured?.height ?? n.height ?? FALLBACK_SIZE.height,
    })),
    edges: edges
      .filter(
        (e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target,
      )
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
  const result = await elk.layout(graph);
  return new Map(result.children.map((c) => [c.id, { x: c.x, y: c.y }]));
}
