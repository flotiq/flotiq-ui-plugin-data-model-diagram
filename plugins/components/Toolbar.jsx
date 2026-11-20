/**
 * Toolbar built from a declarative list of groups → easy to add more buttons.
 * Item: { key, label, title?, onClick, active?, disabled? } | { key, render: () => ReactNode }
 */
export default function Toolbar({ groups, status }) {
  return (
    <div className="fq-toolbar">
      {groups.map((group, index) => (
        <div key={index} className="fq-toolbar__group">
          {group.map((item) =>
            item.render ? (
              <span key={item.key}>{item.render()}</span>
            ) : (
              <button
                key={item.key}
                type="button"
                className={`fq-btn${item.active ? ' fq-btn--active' : ''}`}
                title={item.title || item.label}
                disabled={item.disabled}
                aria-pressed={
                  item.active === undefined ? undefined : !!item.active
                }
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ))}
      {status && <span className="fq-toolbar__status">{status}</span>}
    </div>
  );
}
