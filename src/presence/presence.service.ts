import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface TenantMemberDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  isOnline: boolean;
}

@Injectable()
export class PresenceService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.tenantMember.updateMany({
      data: { isOnline: false },
    });
  }

  async updatePresence(
    tenantId: string,
    userId: string,
    isOnline: boolean,
  ): Promise<void> {
    try {
      await this.prisma.tenantMember.update({
        where: {
          tenantId_userId: { tenantId, userId },
        },
        data: { isOnline },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return;
      }

      console.error(`Presence DB Update Error for User ${userId}:`, error);

      throw new InternalServerErrorException('Failed to update presence');
    }
  }

  async getOnlineMemberIds(tenantId: string): Promise<string[]> {
    try {
      const onlineMembers = await this.prisma.tenantMember.findMany({
        where: { tenantId, isOnline: true },
        select: { userId: true },
      });

      return onlineMembers.map((m) => m.userId);
    } catch (error: unknown) {
      console.error('Error fetching online member IDs:', error);

      return [];
    }
  }

  async getTenantMembers(tenantId: string): Promise<TenantMemberDTO[]> {
    try {
      const members = await this.prisma.tenantMember.findMany({
        where: { tenantId },
        select: {
          role: true,
          isOnline: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          user: { firstName: 'asc' },
        },
      });

      return members.map(
        (m): TenantMemberDTO => ({
          id: m.user.id,
          name:
            `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() ||
            'Unknown User',
          email: m.user.email,
          role: m.role,
          isOnline: m.isOnline,
        }),
      );
    } catch (error: unknown) {
      console.error('Error fetching tenant members:', error);

      throw new InternalServerErrorException('Failed to fetch team members');
    }
  }
}
