/**
 * Pure helpers: turn Flotiq Content Type Definitions into a normalized
 * data model (entities + fields + relations).
 * No DOM / Flotiq globals here, so it can be unit-tested with plain node.
 */

export const ANY_TYPE = '__any_type__';

const isInternalName = (name) => name?.startsWith('_');

// Like the rest of the editor (relations, API keys, all objects): of the system types
// only media and tags are shown; the others (_plugin_settings, _webhooks...) are left out.
export const SHOWN_SYSTEM_TYPES = ['_media', '_tag'];
const isLeftOut = (name, internal) =>
  (internal || isInternalName(name)) && !SHOWN_SYSTEM_TYPES.includes(name);

function parseFields(
  properties = {},
  propertiesConfig = {},
  order,
  required = [],
  prefix = '',
) {
  const names = [
    ...(order || []).filter((n) => n in propertiesConfig || n in properties),
    ...Object.keys(propertiesConfig).filter((n) => !(order || []).includes(n)),
  ];
  const fields = [];
  for (const name of names) {
    const config = propertiesConfig[name] || {};
    const schema = properties[name] || {};
    const inputType = config.inputType || schema.type || 'unknown';
    const path = prefix ? `${prefix}[].${name}` : name;
    const field = {
      name,
      path,
      label: config.label || name,
      inputType,
      required: required.includes(name),
      unique: !!config.unique,
      isTitlePart: !!config.isTitlePart,
      inList: !!prefix,
      relation: null,
    };

    if (inputType === 'datasource') {
      const target = config.validation?.relationContenttype;
      field.relation = {
        target: target || ANY_TYPE,
        // Flotiq stores it in validation.relationMultiple; a missing flag means multiple
        multiple:
          (config.validation?.relationMultiple ?? config.multiple) !== false,
      };
    }
    fields.push(field);

    // List field ("object" input type) — nested fields live in items.
    if (inputType === 'object' && config.items) {
      fields.push(
        ...parseFields(
          schema.items?.properties,
          config.items.propertiesConfig,
          config.items.order,
          schema.items?.required,
          path,
        ),
      );
    }
  }
  return fields;
}

/**
 * @param {Array} contentTypes ContentTypeDefinition[]
 * @returns {{ entities: Map<string, object>, relations: Array }}
 */
export function buildModel(contentTypes) {
  const entities = new Map();
  for (const ctd of contentTypes || []) {
    if (isLeftOut(ctd.name, ctd.internal)) continue;
    const schemaDef = ctd.schemaDefinition || {};
    const meta = ctd.metaDefinition || {};
    const fields = parseFields(
      schemaDef.allOf?.[1]?.properties,
      meta.propertiesConfig,
      meta.order,
      schemaDef.required,
    );
    entities.set(ctd.name, {
      name: ctd.name,
      label: ctd.label || ctd.name,
      internal: !!ctd.internal || isInternalName(ctd.name),
      stub: false,
      fields,
    });
  }

  const relations = [];
  for (const entity of entities.values()) {
    for (const field of entity.fields) {
      if (!field.relation) continue;
      const { target, multiple } = field.relation;
      if (target !== ANY_TYPE && isLeftOut(target, false)) continue;
      if (!entities.has(target)) {
        // Referenced type we couldn't read (e.g. _media, _tag, or "any type").
        entities.set(target, {
          name: target,
          label: target === ANY_TYPE ? 'Any content type' : target,
          internal: target !== ANY_TYPE && isInternalName(target),
          stub: true,
          fields: [],
        });
      }
      relations.push({
        from: entity.name,
        to: target,
        field: field.path,
        multiple,
        required: field.required,
      });
    }
  }
  return { entities, relations };
}

/** Normalize the different response shapes seen from client.getContentTypes */
export function extractContentTypes(response) {
  if (Array.isArray(response)) return { data: response, totalPages: null };
  const body = response?.body ?? response;
  if (Array.isArray(body)) return { data: body, totalPages: null };
  return { data: body?.data || [], totalPages: body?.total_pages ?? null };
}
