import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMonitorDto, UpdateMonitorDto } from './dto/create-monitor.dto';
import { MonitorRepository } from './monitor.repository';

@Injectable()
export class MonitorService {
  constructor(private readonly monitorRepo: MonitorRepository) {}

  create(dto: CreateMonitorDto, userId: string) {
    this.validatorUrlSecurity(dto.url);

    const nextRunTime = new Date();
    nextRunTime.setSeconds(nextRunTime.getSeconds() + dto.interval);

    return this.monitorRepo.create(userId, dto, nextRunTime);
  }

  async findManyByUserId(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    return await this.monitorRepo.findManyByUserId(
      tenantId,
      page,
      limit,
      search,
    );
  }

  async findOneById(id: string, tenantId: string) {
    const monitor = await this.monitorRepo.findOneById(id, tenantId);

    if (!monitor) {
      throw new NotFoundException(
        'The monitor could not be found, or you do not have permission to do so.',
      );
    }

    return monitor;
  }

  async update(id: string, tenantId: string, dto: UpdateMonitorDto) {
    this.validatorUrlSecurity(dto.url!);
    const result = await this.monitorRepo.update(id, tenantId, dto);

    if (result.count === 0) {
      throw new NotFoundException(
        'Monitor could not be found or update is not allowed.',
      );
    }
    return { success: true, message: 'Monitor update successfully' };
  }

  async softDelete(id: string, tenantId: string) {
    const result = await this.monitorRepo.softDelete(id, tenantId);

    if (result.count === 0) {
      throw new NotFoundException(
        'Monitor could not be found or delete is not allowed.',
      );
    }
    return { success: true, message: 'Monitor soft-delete successfully' };
  }

  private validatorUrlSecurity(urlString: string) {
    const url = new URL(urlString);
    const hostname = url.hostname;

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.')
    ) {
      throw new BadRequestException(
        'Internal URL cannot be monitored for security reasons.',
      );
    }
  }
}
