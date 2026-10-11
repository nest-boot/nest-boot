import { BaseQueue, Queue } from "@nest-boot/queue";

import { SCHEDULE_QUEUE_NAME } from "./schedule.module-definition.js";

/** Internal queue shared by the scheduler and its consumer. */
@Queue({ name: SCHEDULE_QUEUE_NAME })
export class ScheduleQueue extends BaseQueue {}
