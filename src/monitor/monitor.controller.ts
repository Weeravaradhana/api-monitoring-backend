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

@Controller('monitor')
@UseGuards(JwtAuthGuard)
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createMonitorDto.createMonitorSchema))
  create(
    @Body()
    dto: createMonitorDto.CreateMonitorDto,
    @GetUser('sub') userId: string,
  ) {
    return this.monitorService.create(dto, userId);
  }

  @Get()
  findManyByUserId(
    @GetUser('sub') userId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.monitorService.findManyByUserId(userId, page, limit);
  }

  @Get(':id')
  findOneById(@Param('id') id: string, @GetUser('sub') userId: string) {
    return this.monitorService.findOneById(id, userId);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(createMonitorDto.UpdateMonitorSchema))
  update(
    @Param('id') id: string,
    @GetUser('sub') userId: string,
    @Body() dto: createMonitorDto.UpdateMonitorDto,
  ) {
    return this.monitorService.update(id, userId, dto);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @GetUser('sub') userId: string) {
    return this.monitorService.softDelete(id, userId);
  }
}
