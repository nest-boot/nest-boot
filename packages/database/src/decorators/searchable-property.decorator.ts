import { Property, PropertyOptions } from "@mikro-orm/core";
import pick from "lodash.pick";

export interface SearchablePropertyOptions<T extends object>
  extends PropertyOptions<T> {
  properties: (keyof T)[];
}

export function SearchableProperty<T extends object>({
  properties,
  ...options
}: SearchablePropertyOptions<T>): PropertyDecorator {
  if (properties.length === 0) {
    throw new Error("properties must have at least one property");
  }

  return (target, propertyKey: string | symbol) => {
    if (typeof propertyKey === "string") {
      const usingWeights = properties.length > 1;

      Property<T>({
        hidden: true,
        onCreate: (entity) =>
          usingWeights ? pick(entity, properties) : entity[properties[0]],
        onUpdate: (entity, em) => {
          // 获取原始数据
          const originalEntity = em
            .getUnitOfWork()
            .getOriginalEntityData(entity);

          // 比较原始数据和当前数据，如果不同则更新
          if (
            originalEntity &&
            (usingWeights
              ? properties.some(
                  (property) =>
                    (originalEntity as T)[property] !== entity[property],
                )
              : (originalEntity as T)[properties[0]] !== entity[properties[0]])
          ) {
            return usingWeights
              ? pick(entity, properties)
              : entity[properties[0]];
          }
        },
        ...options,
      })(target, propertyKey);
    }
  };
}
