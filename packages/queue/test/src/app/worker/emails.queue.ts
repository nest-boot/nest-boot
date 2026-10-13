import { BaseQueue, Queue } from "@nest-boot/queue";

@Queue({ name: "emails" })
export class EmailsQueue extends BaseQueue {}
