import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ANY_TYPE } from '../data-model/model';

const formatCount = (count) =>
  count === undefined ? '…' : count === null ? '–' : count.toLocaleString();

const entityPath = (entity, spaceSlug) => {
  if (!spaceSlug || entity.name === ANY_TYPE) return null;
  if (entity.name === '_media') return `/s/${spaceSlug}/media`;
  if (entity.internal) return null;
  return `/s/${spaceSlug}/content-type-definitions/edit/${encodeURIComponent(entity.name)}`;
};

const objectsPath = (entity, spaceSlug) =>
  spaceSlug && !entity.internal && entity.name !== ANY_TYPE
    ? `/s/${spaceSlug}/content-type-objects/${encodeURIComponent(entity.name)}`
    : null;

function NavLink({ path, navigate, className, title, children }) {
  if (!path) return <span className={className}>{children}</span>;
  return (
    <a
      className={`${className} nodrag`}
      href={path}
      title={title}
      onClick={(e) => {
        if (!navigate || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey)
          return;
        e.preventDefault();
        navigate(path);
      }}
    >
      {children}
    </a>
  );
}

function fieldBadges(field) {
  const badges = [];
  if (field.required) badges.push(['req', 'required']);
  if (field.unique) badges.push(['UK', 'unique']);
  if (field.isTitlePart) badges.push(['T', 'title field']);
  return badges;
}

function EntityNode({ data }) {
  const {
    entity,
    count,
    dimmed,
    highlighted,
    compact,
    spaceSlug,
    navigate,
    onHide,
  } = data;
  const classes = [
    'fq-node',
    dimmed && 'fq-node--dimmed',
    highlighted && 'fq-node--highlighted',
    entity.stub && 'fq-node--stub',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="fq-handle"
      />
      <div className="fq-node__header">
        <NavLink
          className="fq-node__title"
          path={entityPath(entity, spaceSlug)}
          navigate={navigate}
          title="Open content type definition"
        >
          {entity.label}
        </NavLink>
        {!entity.stub && (
          <NavLink
            className="fq-node__count"
            path={objectsPath(entity, spaceSlug)}
            navigate={navigate}
            title="Content objects"
          >
            {formatCount(count)}
          </NavLink>
        )}
        <button
          type="button"
          className="fq-node__hide nodrag"
          title="Hide"
          onClick={() => onHide(entity.name)}
        >
          ×
        </button>
      </div>
      {entity.label !== entity.name && !entity.stub && (
        <div className="fq-node__api-name">{entity.name}</div>
      )}

      {!compact &&
        entity.fields.map((field) => (
          <div
            key={field.path}
            className={`fq-field${field.inList ? ' fq-field--nested' : ''}`}
          >
            <span className="fq-field__name" title={field.label}>
              {field.inList ? field.name : field.path}
            </span>
            <span className="fq-field__badges">
              {fieldBadges(field).map(([text, title]) => (
                <span key={text} className="fq-badge" title={title}>
                  {text}
                </span>
              ))}
            </span>
            <span
              className={`fq-field__type${field.relation ? ' fq-field__type--relation' : ''}`}
            >
              {field.relation
                ? `→ ${field.relation.target === ANY_TYPE ? 'any' : field.relation.target}${field.relation.multiple ? '[]' : ''}`
                : field.inputType}
            </span>
            {field.relation && (
              <Handle
                type="source"
                position={Position.Right}
                id={`f:${field.path}`}
                className="fq-handle fq-handle--field"
              />
            )}
          </div>
        ))}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="fq-handle"
      />
    </div>
  );
}

export default memo(EntityNode);
