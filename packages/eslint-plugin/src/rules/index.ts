import entityConstructor from "./entity-constructor";
import entityPropertyNoOptionalOrNonNullAssertion from "./entity-property-no-optional-or-non-null-assertion";
import entityPropertyNullable from "./entity-property-nullable";
import graphqlFieldArgumentsMatchPropertyType from "./graphql-field-arguments-match-property-type";
import graphqlResolverMethodReturnType from "./graphql-resolver-method-return-type";

export default {
  "entity-constructor": entityConstructor,
  "entity-property-no-optional-or-non-null-assertion":
    entityPropertyNoOptionalOrNonNullAssertion,
  "entity-property-nullable": entityPropertyNullable,
  "graphql-field-arguments-match-property-type":
    graphqlFieldArgumentsMatchPropertyType,
  "graphql-resolver-method-return-type": graphqlResolverMethodReturnType,
};
