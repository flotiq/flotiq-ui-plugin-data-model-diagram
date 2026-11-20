const formatCount = (count) =>
  count === undefined ? '…' : count === null ? '–' : count.toLocaleString();

export default function Sidebar({
  entities,
  hidden,
  counts,
  query,
  onQuery,
  onToggle,
  onFocus,
  onShowAll,
  onHideAll,
}) {
  const q = query.trim().toLowerCase();
  const visibleEntities = q
    ? entities.filter(
        (e) =>
          e.label.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
      )
    : entities;

  return (
    <aside className="fq-sidebar">
      <input
        className="fq-input"
        type="search"
        placeholder="Search types and fields…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && visibleEntities[0])
            onFocus(visibleEntities[0].name);
        }}
      />
      <div className="fq-sidebar__actions">
        <button type="button" className="fq-link-btn" onClick={onShowAll}>
          Show all
        </button>
        <button type="button" className="fq-link-btn" onClick={onHideAll}>
          Hide all
        </button>
        <span className="fq-muted">
          {entities.length - hidden.size}/{entities.length}
        </span>
      </div>
      <ul className="fq-sidebar__list">
        {visibleEntities.map((entity) => {
          const isHidden = hidden.has(entity.name);
          return (
            <li
              key={entity.name}
              className={`fq-sidebar__item${isHidden ? ' fq-sidebar__item--hidden' : ''}`}
            >
              <input
                type="checkbox"
                checked={!isHidden}
                title={isHidden ? 'Show' : 'Hide'}
                onChange={() => onToggle(entity.name)}
              />
              <button
                type="button"
                className="fq-sidebar__label"
                title={`${entity.label} (${entity.name})`}
                disabled={isHidden}
                onClick={() => onFocus(entity.name)}
              >
                {entity.label}
              </button>
              {!entity.stub && (
                <span className="fq-sidebar__count">
                  {formatCount(counts[entity.name])}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
