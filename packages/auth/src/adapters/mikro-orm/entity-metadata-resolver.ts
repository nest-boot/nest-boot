import type {
  EntityClass,
  EntityManager,
  EntityProperty,
} from "@mikro-orm/core";
import type { AdapterFactoryCustomizeAdapterCreator } from "better-auth/adapters";

import type { AuthModuleOptions } from "../../auth-module-options.interface.js";

type AdapterContext = Parameters<AdapterFactoryCustomizeAdapterCreator>[0];
type EntityRecord = Record<string, unknown>;

export interface EntityMetadataResolver {
  getColumnName(model: string, field: string): string;
  getEntityClass(model: string): EntityClass<object>;
  getPropertyName(model: string, field: string): string;
  toAdapterRecord(model: string, entity: object): object;
  toEntityData(model: string, data: object): EntityRecord;
}

export function createEntityMetadataResolver(
  em: EntityManager,
  entities: AuthModuleOptions["entities"],
  context: AdapterContext,
): EntityMetadataResolver {
  const metadataCache = new Map<string, Record<string, EntityProperty>>();

  const getDefaultModelName = (model: string) =>
    context.getDefaultModelName(model);

  const getEntityClass = (model: string): EntityClass<object> => {
    const defaultModelName = getDefaultModelName(model);
    const entity = entities[defaultModelName as keyof typeof entities];

    if (!entity) {
      throw new Error(
        `No MikroORM entity is configured for Better Auth model "${defaultModelName}"`,
      );
    }

    return entity;
  };

  const getProperties = (model: string) => {
    const defaultModelName = getDefaultModelName(model);
    const cached = metadataCache.get(defaultModelName);

    if (cached) return cached;

    const metadata = em.getMetadata().get(getEntityClass(model));
    const properties = metadata.properties as Record<string, EntityProperty>;
    metadataCache.set(defaultModelName, properties);
    return properties;
  };

  const getPropertyName = (model: string, field: string) => {
    const defaultFieldName = context.getDefaultFieldName({ field, model });
    const properties = getProperties(model);

    if (properties[defaultFieldName]) return defaultFieldName;
    if (properties[field]) return field;

    return (
      Object.entries(properties).find(([, property]) =>
        property.fieldNames.includes(field),
      )?.[0] ?? defaultFieldName
    );
  };

  const getColumnName = (model: string, field: string) => {
    const propertyName = getPropertyName(model, field);
    return getProperties(model)[propertyName]?.fieldNames[0] ?? field;
  };

  const toEntityData = (model: string, data: object) =>
    Object.fromEntries(
      Object.entries(data).map(([field, value]) => [
        getPropertyName(model, field),
        value,
      ]),
    );

  const toAdapterRecord = (model: string, entity: object) => {
    const defaultModelName = getDefaultModelName(model);
    const fields = context.schema[defaultModelName]?.fields;

    if (!fields) return entity;

    const entityRecord = entity as EntityRecord;
    const adapterRecord: EntityRecord = { ...entityRecord };
    let hasAliases = false;

    for (const defaultFieldName of Object.keys(fields)) {
      const adapterFieldName = context.getFieldName({
        field: defaultFieldName,
        model: defaultModelName,
      });
      const propertyName = getPropertyName(model, adapterFieldName);

      if (adapterFieldName === propertyName) continue;

      adapterRecord[adapterFieldName] = entityRecord[propertyName];
      hasAliases = true;
    }

    return hasAliases ? adapterRecord : entity;
  };

  return {
    getColumnName,
    getEntityClass,
    getPropertyName,
    toAdapterRecord,
    toEntityData,
  };
}
