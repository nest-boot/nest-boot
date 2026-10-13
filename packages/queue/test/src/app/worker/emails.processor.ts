import { Processor } from "@nest-boot/queue";

import { EmailsQueue } from "./emails.queue.js";
import { ReportsProcessor } from "./reports.processor.js";

@Processor(EmailsQueue)
export class EmailsProcessor extends ReportsProcessor {}
