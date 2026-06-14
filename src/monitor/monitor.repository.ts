import { PrismaService } from '../prisma/prisma.service';
import { CreateMonitorDto, UpdateMonitorDto } from './dto/create-monitor.dto';
import { MonitorStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MonitorRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateMonitorDto, nextRunAt: Date) {
    return this.prisma.monitor.create({
      data: {
        ...dto,
        tenantId,
        nextRunAt,
      },
    });
  }

  async findManyByUserId(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const [totalItems, monitors] = await Promise.all([
      this.prisma.monitor.count({
        where: {
          tenantId,
          status: { not: MonitorStatus.DELETED },
          ...(search && {
            OR: [
              {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                url: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }),
        },
      }),

      this.prisma.monitor.findMany({
        where: {
          tenantId,
          status: { not: MonitorStatus.DELETED },
          ...(search && {
            OR: [
              {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                url: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }),
        },
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          url: true,
          method: true,
          lastState: true,
          timeout: true,
          interval: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: monitors,
      meta: {
        totalItems,
        itemCount: monitors.length,
        itemPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  findOneById(id: string, tenantId: string) {
    return this.prisma.monitor.findFirst({
      where: { id, tenantId, status: { not: MonitorStatus.DELETED } },
    });
  }

  update(id: string, tenantId: string, dto: UpdateMonitorDto) {
    return this.prisma.monitor.updateMany({
      where: { id, tenantId, status: { not: MonitorStatus.DELETED } },
      data: dto,
    });
  }

  softDelete(id: string, tenantId: string) {
    return this.prisma.monitor.updateMany({
      where: { id, tenantId },
      data: { status: MonitorStatus.DELETED },
    });
  }
}
