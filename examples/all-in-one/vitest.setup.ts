import { vi } from 'vitest';

const classDecorator = () => () => undefined;
const methodDecorator = () => () => undefined;
const parameterDecorator = () => () => undefined;
const propertyDecorator = () => () => undefined;

vi.mock('@nest-boot/graphql', () => ({
  Args: parameterDecorator,
  ArgsType: classDecorator,
  Context: parameterDecorator,
  Field: propertyDecorator,
  Float: Number,
  GraphQLModule: {
    forRoot: vi.fn(() => ({
      module: class MockGraphQLModule {},
    })),
    forRootAsync: vi.fn(() => ({
      module: class MockGraphQLModule {},
    })),
  },
  HideField: propertyDecorator,
  ID: String,
  InputType: classDecorator,
  Int: Number,
  Mutation: methodDecorator,
  ObjectType: classDecorator,
  Parent: parameterDecorator,
  Query: methodDecorator,
  ResolveField: methodDecorator,
  Resolver: classDecorator,
  registerEnumType: vi.fn(),
}));
