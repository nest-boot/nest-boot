import { assertCan } from '@nest-boot/auth';
import { Injectable, NotFoundException } from '@nestjs/common';

import { Report } from './report.js';
import { ReportRepository } from './report.repository.js';

/** Example only: register with an application-owned ReportRepository when adopting the recipe. */
@Injectable()
export class ReportService {
  constructor(private readonly repository: ReportRepository) {}

  async getReport(id: string): Promise<Report> {
    const report = await this.loadReport(id);
    assertCan('read', report);
    return report;
  }

  async archiveReport(id: string): Promise<Report> {
    const report = await this.loadReport(id);
    assertCan('archive', report);
    return await this.repository.archive(report);
  }

  private async loadReport(id: string): Promise<Report> {
    const report = await this.repository.findOne(id);
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }
}
