import {
  type Constructor,
  type EntityClass,
  MetadataStorage,
} from "@mikro-orm/core";

let configuredTargets = new Map<Constructor<object>, EntityClass<object>>();

/** Configures relation targets before MikroORM starts entity discovery. */
export function configureAuthRelationTargets(
  entries: Iterable<readonly [Constructor<object>, EntityClass<object>]>,
) {
  configuredTargets = new Map(entries);
}

/** Resolves the concrete MikroORM entity registered for an auth base class. */
export function resolveAuthRelationTarget<Entity extends object>(
  baseEntity: Constructor<Entity>,
  conventionalName: string,
): EntityClass<Entity> | string {
  const configuredTarget = configuredTargets.get(baseEntity);
  if (configuredTarget) return configuredTarget as EntityClass<Entity>;

  const candidates = new Set<EntityClass<Entity>>();

  for (const metadata of Object.values(MetadataStorage.getMetadata())) {
    const entity = metadata.class as EntityClass<Entity> | undefined;
    if (
      metadata.name &&
      entity &&
      entity !== baseEntity &&
      entity.prototype instanceof baseEntity
    ) {
      candidates.add(entity);
    }
  }

  const conventionalEntity = [...candidates].find(
    (entity) => entity.name === conventionalName,
  );
  if (conventionalEntity) return conventionalEntity;
  const [onlyCandidate] = candidates;
  if (candidates.size === 1 && onlyCandidate) return onlyCandidate;
  if (candidates.size === 0) return conventionalName;

  throw new Error(
    `Multiple concrete entities extend ${baseEntity.name}; unable to resolve the auth relation target`,
  );
}
