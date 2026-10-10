import { Report } from './report.js';

/** Implement with the application's persistence layer; never trust client-supplied ownership fields. */
export abstract class ReportRepository {
  abstract findOne(id: string): Promise<Report | null>;
  abstract archive(report: Report): Promise<Report>;
}
