import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import * as createMonitorDto from './dto/create-monitor.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { MonitorService } from './monitor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';

@Controller('monitors')
@UseGuards(JwtAuthGuard)
export class MonitorController {
  constructor(
    private readonly monitorService: MonitorService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createMonitorDto.createMonitorSchema))
  create(
    @Body()
    dto: createMonitorDto.CreateMonitorDto,
    @GetUser('tenantId') tenantId: string,
  ) {
    return this.monitorService.create(dto, tenantId);
  }

  @Get()
  findManyByUserId(
    @GetUser('tenantId') tenantId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search?: string,
  ) {
    return this.monitorService.findManyByUserId(tenantId, page, limit, search);
  }

  @Get(':id')
  findOneById(@Param('id') id: string, @GetUser('tenantId') tenantId: string) {
    return this.monitorService.findOneById(id, tenantId);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(createMonitorDto.UpdateMonitorSchema))
  update(
    @Param('id') id: string,
    @GetUser('tenantId') tenantId: string,
    @Body() dto: createMonitorDto.UpdateMonitorDto,
  ) {
    return this.monitorService.update(id, tenantId, dto);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @GetUser('tenantId') tenantId: string) {
    return this.monitorService.softDelete(id, tenantId);
  }

  @Get('analytics/kpi')
  getKpiAnalytics(@GetUser('tenantId') tenantId: string) {
    return this.analyticsService.getDashboardKpiAnalytics(tenantId);
  }
}
