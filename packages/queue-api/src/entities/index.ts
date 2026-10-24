import { Job as JobEntity } from "./job.entity.js";
export { Job as JobEntity } from "./job.entity.js";

/** Job history entities; Redis owns all queue operational state. */
export const entities = [JobEntity];
