import type { PropertyOptions } from '@mikro-orm/core';
import { Property } from '@mikro-orm/decorators/legacy';
import { Jieba } from '@node-rs/jieba';
import { dict } from '@node-rs/jieba/dict.js';
import { mapValues, pick } from 'lodash-es';

/** 可搜索字段装饰器配置。 */
export interface SearchablePropertyOptions<
  T extends object,
> extends PropertyOptions<T> {
  /** 参与中文分词并写入目标搜索字段的实体属性列表。 */
  properties: (keyof T)[];
}

/**
 * 使用 `node-rs/jieba` 对文本进行中文分词。
 * 采用搜索分词模式生成更完整的词项，适合全文搜索场景。
 */
const jieba = Jieba.withDict(dict);

function segmentText(text: unknown): string | undefined {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return undefined;
  }

  const words = jieba.cutForSearch(text);

  // 过滤空白词并用空格连接
  return words.filter((w) => w.trim().length > 0).join(' ');
}

/**
 * 对对象中的每个属性值进行分词。
 */
function segmentValues<T extends object>(
  obj: Partial<T>,
): Record<string, string | undefined> {
  return mapValues(obj, (value) => segmentText(value));
}

/**
 * 将一个隐藏字段声明为由其他文本字段派生的全文搜索字段。
 *
 * @param options - 可搜索字段配置。
 * @returns MikroORM 属性装饰器。
 */
export function SearchableProperty<T extends object>({
  properties,
  ...options
}: SearchablePropertyOptions<T>): PropertyDecorator {
  if (properties.length === 0) {
    throw new Error('properties must have at least one property');
  }

  return (target, propertyKey: string | symbol) => {
    if (typeof propertyKey === 'string') {
      const usingWeights = properties.length > 1;

      Property<T>({
        hidden: true,
        onCreate: (entity) =>
          usingWeights
            ? segmentValues(pick(entity, properties))
            : segmentText(entity[properties[0]]),
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
              ? segmentValues(pick(entity, properties))
              : segmentText(entity[properties[0]]);
          }
        },
        ...options,
      })(target as T, propertyKey);
    }
  };
}
