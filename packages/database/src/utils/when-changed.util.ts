import type {
  EntityClass,
  EntityProperty,
  PropertyOptions,
} from "@mikro-orm/core";

/**
 * Guards a MikroORM onUpdate callback with source properties compared using ORM snapshots.
 * Preserves the target value when no source changes or no original snapshot exists.
 * @template Entity - Entity containing the watched properties.
 * @param update - Callback to run when any watched property changes.
 * @param properties - Source properties to watch.
 * @returns Callback for MikroORM's onUpdate option.
 * @throws {Error} If sources are missing, a required source is unloaded, or the property context is missing.
 */
export function whenChanged<Entity extends object>(
  update: NonNullable<PropertyOptions<Entity>["onUpdate"]>,
  properties: readonly (keyof Entity)[],
): NonNullable<PropertyOptions<Entity>["onUpdate"]> {
  if (properties.length === 0) {
    throw new Error("properties must have at least one property");
  }
  return function (this: EntityProperty<Entity>, entity, em) {
    if (!this || typeof this.name !== "string") {
      throw new Error(
        "whenChanged must be used as a MikroORM onUpdate callback",
      );
    }
    const original = em.getUnitOfWork().getOriginalEntityData(entity);
    if (original) {
      const comparator = em.getComparator();
      const changes = comparator.diffEntities(
        entity.constructor as EntityClass<Entity>,
        original,
        comparator.prepareEntity(entity),
      );
      if (properties.some((property) => Object.hasOwn(changes, property))) {
        const unloaded = properties.filter(
          (property) =>
            !Object.hasOwn(original, property) &&
            !Object.hasOwn(changes, property),
        );
        if (unloaded.length > 0) {
          throw new Error(
            `Cannot update ${this.name}: load source properties ${unloaded.map(String).join(", ")} before updating dependent properties`,
          );
        }
        return update.call(this, entity, em);
      }
    }
    return entity[this.name];
  };
}
