import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('monitor')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':id/analytics')
  async getAnalytics(
    @Param('id') monitorId: string,
    @Query('range') range: string = '24h',
  ) {
    return this.analyticsService.getMonitorMetrics(monitorId, range);
  }
}
