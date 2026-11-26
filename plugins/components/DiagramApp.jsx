import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import EntityNode from './EntityNode';
import Sidebar from './Sidebar';
import Toolbar from './Toolbar';
import { buildModel } from '../data-model/model';
import { loadContentTypes, loadCounts } from '../data-model/api';
import { computeLayout } from '../data-model/layout';
import { exportImage, printDiagram } from '../data-model/export';
import {
  clearLocalLayout,
  readLocalLayout,
  readTeamLayout,
  saveTeamLayout,
  writeLocalLayout,
} from '../data-model/storage';

const nodeTypes = { entity: EntityNode };
const getSpaceSlug = () =>
  window.location.pathname.match(/^\/s\/([^/]+)/)?.[1] || null;

function useEditorDarkMode() {
  const read = () => document.documentElement.classList.contains('mode-dark');
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function matchesQuery(entity, q) {
  if (!q) return false;
  return (
    entity.label.toLowerCase().includes(q) ||
    entity.name.toLowerCase().includes(q) ||
    entity.fields.some(
      (f) =>
        f.path.toLowerCase().includes(q) || f.label.toLowerCase().includes(q),
    )
  );
}

function Diagram({ client, globals, pluginInfo }) {
  const rootRef = useRef(null);
  const { fitView, getNodes } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const darkMode = useEditorDarkMode();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);
  const [counts, setCounts] = useState({});
  const [hidden, setHidden] = useState(() => new Set());
  const [compact, setCompact] = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState(null);
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // 'all' = layout every node, 'missing' = only nodes without a saved position, null = nothing pending
  const pendingLayout = useRef(null);
  const savedPositions = useRef({});

  const notify = useCallback(
    (message, type = 'success') => {
      setNotice(message);
      globals?.toast?.[type]?.(message);
      setTimeout(
        () => setNotice((current) => (current === message ? '' : current)),
        4000,
      );
    },
    [globals],
  );

  // ---- data ---------------------------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    loadContentTypes(client)
      .then((contentTypes) => {
        if (cancelled) return;
        setError(null);
        const nextModel = buildModel(contentTypes);
        const saved =
          readLocalLayout(pluginInfo.id) || readTeamLayout(globals) || {};
        savedPositions.current = saved.positions || {};
        setHidden(new Set(saved.hidden || []));
        setModel(nextModel);
        setCounts({});
        loadCounts(
          client,
          [...nextModel.entities.values()]
            .filter((e) => !e.stub)
            .map((e) => e.name),
          (name, count) => setCounts((prev) => ({ ...prev, [name]: count })),
          abort.signal,
        );
      })
      .catch((e) => !cancelled && setError(e?.message || String(e)));
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [client, globals, pluginInfo.id, reloadKey]);

  const spaceSlug = useMemo(() => getSpaceSlug(), []);
  const hideNode = useCallback(
    (name) => setHidden((prev) => new Set(prev).add(name)),
    [],
  );

  // ---- nodes: (re)built when the model changes, data patched otherwise (keeps positions / measurements) -----
  useEffect(() => {
    if (!model) return;
    const positions = savedPositions.current;
    const entities = [...model.entities.values()];
    const missing = entities.some((e) => !positions[e.name]);
    pendingLayout.current =
      Object.keys(positions).length === 0 ? 'all' : missing ? 'missing' : null;
    setNodes(
      entities.map((entity) => ({
        id: entity.name,
        type: 'entity',
        position: positions[entity.name] || { x: 0, y: 0 },
        data: { entity },
      })),
    );
  }, [model, setNodes]);

  const q = query.trim().toLowerCase();
  useEffect(() => {
    if (!model) return;
    setNodes((prev) =>
      prev.map((node) => {
        const entity = model.entities.get(node.id);
        const match = matchesQuery(entity, q);
        return {
          ...node,
          hidden: hidden.has(node.id) || (entity.internal && !showInternal),
          data: {
            entity,
            count: counts[node.id],
            compact,
            highlighted: match,
            dimmed: !!q && !match,
            spaceSlug,
            navigate: globals?.navigate,
            onHide: hideNode,
          },
        };
      }),
    );
  }, [
    model,
    hidden,
    showInternal,
    counts,
    compact,
    q,
    spaceSlug,
    globals,
    hideNode,
    setNodes,
  ]);

  // ---- edges (derived) ------------------------------------------------------------------------------------
  const edges = useMemo(() => {
    if (!model) return [];
    return model.relations.map((r) => {
      const active = hovered && (r.from === hovered || r.to === hovered);
      return {
        id: `${r.from}.${r.field}`,
        source: r.from,
        target: r.to,
        sourceHandle: compact ? 'out' : `f:${r.field}`,
        targetHandle: 'in',
        type: 'smoothstep',
        pathOptions: { borderRadius: 12 },
        label: compact ? r.field : undefined,
        className: `fq-edge${active ? ' fq-edge--active' : ''}${hovered && !active ? ' fq-edge--muted' : ''}`,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        zIndex: active ? 10 : 0,
      };
    });
  }, [model, compact, hovered]);

  // ---- layout ---------------------------------------------------------------------------------------------
  const persistLocal = useCallback(
    (nextHidden = hidden) => {
      const positions = Object.fromEntries(
        getNodes().map((n) => [n.id, n.position]),
      );
      savedPositions.current = positions;
      writeLocalLayout(pluginInfo.id, {
        positions,
        hidden: [...nextHidden],
      });
    },
    [getNodes, hidden, pluginInfo.id],
  );

  const runLayout = useCallback(
    async (mode = 'all') => {
      const current = getNodes();
      const positions = await computeLayout(current, edges);
      const keep = mode === 'missing' ? savedPositions.current : {};
      setNodes((prev) =>
        prev.map((n) =>
          keep[n.id] || !positions.has(n.id)
            ? n
            : { ...n, position: positions.get(n.id) },
        ),
      );
      requestAnimationFrame(() => {
        fitView({ padding: 0.1, duration: 300 });
        persistLocal(hidden);
      });
    },
    [edges, fitView, getNodes, hidden, persistLocal, setNodes],
  );

  useEffect(() => {
    if (!nodesInitialized || !nodes.length) return;
    if (pendingLayout.current) {
      const mode = pendingLayout.current;
      pendingLayout.current = null;
      runLayout(mode);
    } else if (!rootRef.current?.dataset.fitted) {
      rootRef.current.dataset.fitted = '1';
      fitView({ padding: 0.1 });
    }
  }, [nodesInitialized, nodes.length, runLayout, fitView]);

  // persist hide/show changes
  const firstPersist = useRef(true);
  useEffect(() => {
    if (!model) return;
    if (firstPersist.current) {
      firstPersist.current = false;
      return;
    }
    persistLocal(hidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  // ---- actions --------------------------------------------------------------------------------------------
  const focusNode = useCallback(
    (name) => {
      setHidden((prev) => {
        if (!prev.has(name)) return prev;
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      requestAnimationFrame(() =>
        fitView({
          nodes: [{ id: name }],
          duration: 400,
          maxZoom: 1.2,
          padding: 0.4,
        }),
      );
    },
    [fitView],
  );

  const toggleHidden = useCallback((name) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const sidebarEntities = useMemo(
    () =>
      model
        ? [...model.entities.values()]
            .filter((e) => showInternal || !e.internal)
            .sort((a, b) => a.label.localeCompare(b.label))
        : [],
    [model, showInternal],
  );

  const withErrorNotice = (fn) => async () => {
    try {
      await fn();
    } catch (e) {
      notify(e?.message || String(e), 'error');
    }
  };

  const teamLayout = readTeamLayout(globals);
  const applyLayout = (layout) => {
    savedPositions.current = layout.positions || {};
    setHidden(new Set(layout.hidden || []));
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        position: savedPositions.current[n.id] || n.position,
      })),
    );
    requestAnimationFrame(() => fitView({ padding: 0.1, duration: 300 }));
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  };

  // A <select> used as a compact action menu: picking an option runs it, then the placeholder comes back.
  const actionSelect = (placeholder, title, options, onPick) => (
    <select
      className="fq-btn fq-select"
      title={title}
      value=""
      onChange={(e) => {
        const value = e.target.value;
        if (value) onPick(value);
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );

  const groups = [
    [
      {
        key: 'arrange',
        label: 'Auto layout',
        title: 'Arrange all visible types automatically',
        onClick: () => runLayout('all'),
      },
    ],
    [
      {
        key: 'save',
        label: 'Save layout',
        title:
          'Save positions and hidden types in the plugin settings (shared with everyone in this space)',
        onClick: withErrorNotice(async () => {
          const positions = Object.fromEntries(
            getNodes().map((n) => [n.id, n.position]),
          );
          await saveTeamLayout(client, globals, pluginInfo.id, {
            positions,
            hidden: [...hidden],
          });
          notify('Layout saved');
        }),
      },
      {
        key: 'load',
        label: 'Load layout',
        title: teamLayout
          ? `Load the saved layout (${teamLayout.savedAt || ''})`
          : 'No saved layout yet',
        disabled: !teamLayout,
        onClick: () => {
          applyLayout(teamLayout);
          persistLocal(new Set(teamLayout.hidden || []));
          notify('Layout loaded');
        },
      },
      {
        key: 'reset',
        label: 'Reset',
        title:
          'Show all types and arrange them automatically (the saved layout is kept)',
        onClick: () => {
          clearLocalLayout(pluginInfo.id);
          savedPositions.current = {};
          setHidden(new Set());
          runLayout('all');
        },
      },
    ],
    [
      {
        key: 'fields',
        label: 'Fields',
        active: !compact,
        onClick: () => setCompact((c) => !c),
      },
      {
        key: 'internal',
        label: 'Media & tags',
        title: 'Show media and tags (the only system types used in relations)',
        active: showInternal,
        onClick: () => setShowInternal((v) => !v),
      },
      {
        key: 'sidebar',
        label: 'List',
        active: showSidebar,
        onClick: () => setShowSidebar((v) => !v),
      },
    ],
    [
      {
        key: 'export',
        render: () =>
          actionSelect(
            'Export',
            'Export or print the whole diagram',
            [
              ['png', 'PNG image'],
              ['svg', 'SVG image'],
              ['print', 'Print…'],
            ],
            (format) =>
              withErrorNotice(() =>
                format === 'print'
                  ? printDiagram(rootRef.current, getNodes())
                  : exportImage(rootRef.current, getNodes(), format),
              )(),
          ),
      },
      {
        key: 'refresh',
        label: '⟳',
        title: 'Reload content types and counts',
        onClick: () => {
          setError(null);
          setReloadKey((k) => k + 1);
        },
      },
      {
        key: 'settings',
        label: '⚙',
        title: 'Plugin settings (Plugins → Manage)',
        disabled: !spaceSlug || !globals?.navigate,
        onClick: () => globals.navigate(`/s/${spaceSlug}/plugins`),
      },
      {
        key: 'fullscreen',
        label: '⛶',
        title: 'Fullscreen',
        onClick: toggleFullscreen,
      },
    ],
  ];

  // relations between the types shown in the diagram (hidden and system types are left out)
  const shownTypes = new Set(
    sidebarEntities.filter((e) => !hidden.has(e.name)).map((e) => e.name),
  );
  const shownRelations = (model?.relations || []).filter(
    (r) => shownTypes.has(r.from) && shownTypes.has(r.to),
  ).length;

  const status = error
    ? `Error: ${error}`
    : !model
      ? 'Loading content types…'
      : notice ||
        `${sidebarEntities.length - hidden.size} of ${sidebarEntities.length} types · ${shownRelations} relations`;

  return (
    <div ref={rootRef} className={`fq-dm${darkMode ? ' fq-dm--dark' : ''}`}>
      <Toolbar groups={groups} status={status} />
      <div className="fq-dm__body">
        {showSidebar && model && (
          <Sidebar
            entities={sidebarEntities}
            hidden={
              new Set(
                [...hidden].filter((n) =>
                  sidebarEntities.some((e) => e.name === n),
                ),
              )
            }
            counts={counts}
            query={query}
            onQuery={setQuery}
            onToggle={toggleHidden}
            onFocus={focusNode}
            onShowAll={() => setHidden(new Set())}
            onHideAll={() =>
              setHidden(new Set(sidebarEntities.map((e) => e.name)))
            }
          />
        )}
        <div className="fq-dm__canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={() => persistLocal()}
            onNodeMouseEnter={(_, node) => setHovered(node.id)}
            onNodeMouseLeave={() => setHovered(null)}
            colorMode={darkMode ? 'dark' : 'light'}
            nodesConnectable={false}
            edgesFocusable={false}
            minZoom={0.05}
            maxZoom={2}
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeStrokeWidth={2}
              className="fq-minimap"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function DiagramApp(props) {
  return (
    <ReactFlowProvider>
      <Diagram {...props} />
    </ReactFlowProvider>
  );
}
