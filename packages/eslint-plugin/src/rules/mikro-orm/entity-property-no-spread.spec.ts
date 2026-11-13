import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { tester } from "../../utils/tester.js";
import rule from "./entity-property-no-spread.js";

tester.run("entity-property-no-spread", rule, {
  valid: [
    `import { Property } from "@mikro-orm/decorators/legacy";
class Book { @Property({ hidden: true, nullable: true }) title!: string | null; }`,
    `import { SearchableProperty } from "@nest-boot/database";
class Book { @SearchableProperty({ properties: ["title"], nullable: true }) title!: string | null; }`,
    `import { Property } from "other-decorators";
class Book { @Property({ ...shared }) title!: string; }`,
    `import { Index } from "@mikro-orm/decorators/legacy";
@Index({ ...shared }) class Book { title!: string; }`,
    `import { Enum } from "@mikro-orm/decorators/legacy";
class Book { @Enum({ items: [...roles] }) role!: string; }`,
    `class Book { options = { ...shared }; }`,
  ],
  invalid: [
    {
      code: `import { Property } from "@mikro-orm/decorators/legacy";
class Book { @Property({ ...shared, hidden: true }) title!: string; }`,
      errors: [{ messageId: "noSpread", type: AST_NODE_TYPES.SpreadElement }],
      output: null,
    },
    {
      code: `import { Property as Column } from "@mikro-orm/decorators/legacy";
class Book { @Column({ type: "text", ...shared }) title!: string; }`,
      errors: [{ messageId: "noSpread" }],
      output: null,
    },
    {
      code: `import * as orm from "@mikro-orm/decorators/legacy";
class Book { @orm.ManyToOne(() => Author, { ...shared }) author!: Author; }`,
      errors: [{ messageId: "noSpread" }],
      output: null,
    },
    {
      code: `import { SearchableProperty as Search } from "@nest-boot/database";
class Book { @Search({ ...shared, properties: "title" }) title!: string; }`,
      errors: [{ messageId: "noSpread" }],
      output: null,
    },
    {
      code: `import * as db from "@nest-boot/database";
class Book { @db.SearchableProperty({ properties: "title", ...shared }) title!: string; }`,
      errors: [{ messageId: "noSpread" }],
      output: null,
    },
    {
      code: `import { EncryptedProperty } from "@nest-boot/database-crypt";
class Book { @EncryptedProperty({ ...shared }) secret!: string; }`,
      errors: [{ messageId: "noSpread" }],
      output: null,
    },
    {
      code: `import { HashedProperty } from "@nest-boot/database-hash";
class Book { @HashedProperty({ ...shared }) password!: string; }`,
      errors: [{ messageId: "noSpread" }],
      output: null,
    },
    {
      code: `import { Property } from "@mikro-orm/decorators/legacy";
class Book { @Property(...shared) title!: string; }`,
      errors: [{ messageId: "noSpread" }],
      output: null,
    },
    {
      code: `import { Index } from "@mikro-orm/decorators/legacy";
class Book { @Index({ ...shared, ...overrides }) title!: string; }`,
      errors: [{ messageId: "noSpread" }, { messageId: "noSpread" }],
      output: null,
    },
  ],
});
