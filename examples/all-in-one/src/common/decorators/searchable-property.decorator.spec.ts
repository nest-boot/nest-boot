import { Property } from '@mikro-orm/decorators/legacy';

const { mockPropertyDecorator } = vi.hoisted(() => ({
  mockPropertyDecorator: vi.fn(),
}));

vi.mock('@mikro-orm/decorators/legacy', () => ({
  Property: vi.fn(() => mockPropertyDecorator),
}));

import { SearchableProperty } from './searchable-property.decorator.js';

interface SearchablePropertyHooks {
  onCreate: (entity: Record<string, unknown>) => string | undefined;
}

describe('SearchableProperty', () => {
  beforeEach(() => {
    vi.mocked(Property).mockClear();
    mockPropertyDecorator.mockClear();
  });

  it('segments a source property with @node-rs/jieba search mode', () => {
    class Entity {}

    SearchableProperty<{ name: string }>({
      properties: ['name'],
      nullable: true,
    })(Entity.prototype, 'searchableName');

    const propertyOptions = vi.mocked(Property).mock.calls[0][0] as
      | SearchablePropertyHooks
      | undefined;

    expect(propertyOptions?.onCreate({ name: '张三 在 上海' })).toBe(
      '张 三 在 上海',
    );
  });

  it('rejects empty source property lists', () => {
    expect(() => {
      SearchableProperty({
        properties: [],
      })({} as object, 'searchableName');
    }).toThrow('properties must have at least one property');
  });

  it('segments multiple source properties as a weighted search object', () => {
    class Entity {}

    SearchableProperty<{ name: string; description: string }>({
      properties: ['name', 'description'],
    })(Entity.prototype, 'searchableText');

    const propertyOptions = vi.mocked(Property).mock.calls[0][0] as
      | SearchablePropertyHooks
      | undefined;

    expect(
      propertyOptions?.onCreate({
        name: '张三',
        description: '上海 工程师',
      }),
    ).toEqual({
      name: '张 三',
      description: '上海 工程 工程师',
    });
  });

  it('updates searchable text only when a source property changed', () => {
    class Entity {}

    SearchableProperty<{ name: string }>({
      properties: ['name'],
    })(Entity.prototype, 'searchableName');

    const propertyOptions = vi.mocked(Property).mock.calls[0][0] as
      | (SearchablePropertyHooks & {
          onUpdate: (
            entity: Record<string, unknown>,
            em: {
              getUnitOfWork: () => {
                getOriginalEntityData: () => Record<string, unknown> | null;
              };
            },
          ) => string | undefined;
        })
      | undefined;

    const unchangedEntityManager = entityManagerWithOriginal({ name: '张三' });
    const changedEntityManager = entityManagerWithOriginal({ name: '李四' });

    expect(
      propertyOptions?.onUpdate({ name: '张三' }, unchangedEntityManager),
    ).toBeUndefined();
    expect(
      propertyOptions?.onUpdate({ name: '张三' }, changedEntityManager),
    ).toBe('张 三');
  });

  it('ignores symbol property keys', () => {
    const key = Symbol('searchableName');

    SearchableProperty<{ name: string }>({
      properties: ['name'],
    })({} as object, key);

    expect(Property).not.toHaveBeenCalled();
  });
});

function entityManagerWithOriginal(original: Record<string, unknown> | null) {
  return {
    getUnitOfWork: () => ({
      getOriginalEntityData: () => original,
    }),
  };
}
