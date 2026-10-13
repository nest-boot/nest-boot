import { BaseQueue, Queue } from "@nest-boot/queue";

export interface ReportData {
  delay?: number;
  userId?: string;
}

@Queue({ name: "reports", expose: true })
export class ReportsQueue extends BaseQueue<ReportData, string> {}
