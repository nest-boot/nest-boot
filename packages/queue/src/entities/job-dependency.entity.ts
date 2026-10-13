import { PrimaryKeyProp, t } from "@mikro-orm/core";
import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";

import { Job } from "./job.entity.js";

/** Read-only mapping of BullMQ's job_dependency table. */
@Entity({ tableName: "job_dependency", schema: "bullmq", readonly: true })
@Index({ name: "dep_parent_status_idx", properties: ["parent", "status"] })
@Index({ name: "dep_child_idx", properties: ["childQueue", "childId"] })
export class JobDependency {
  [PrimaryKeyProp]?: ["parent", "childKey"];

  @ManyToOne(() => Job, {
    fieldNames: ["parent_queue", "parent_id"],
    primary: true,
    mapToPk: true,
    deleteRule: "cascade",
    updateRule: "no action",
    foreignKeyName: "job_dependency_parent_queue_parent_id_fkey",
  })
  parent!: [string, string];

  @Property({ type: t.text, fieldName: "child_queue" })
  childQueue!: string;

  @Property({ type: t.text, fieldName: "child_id" })
  childId!: string;

  @PrimaryKey({ type: t.text, fieldName: "child_key" })
  childKey!: string;

  @Enum({
    items: ["pending", "processed", "ignored", "failed"],
    nativeEnumName: "dep_status",
    default: "pending",
  })
  status!: "pending" | "processed" | "ignored" | "failed";

  @Property({ type: t.json, nullable: true })
  value!: unknown;
}
