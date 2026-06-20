import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantRole } from '@prisma/client';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(TenantService.name);

  async createTenantWithMembers(dto: CreateTenantDto, creatorUserId: string) {
    if (!creatorUserId) {
      this.logger.error(
        'Tenant creation failed: creatorUserId is missing or unauthorized',
      );
      throw new ConflictException(
        'User session is missing. Please log in again.',
      );
    }
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existingTenant)
      throw new ConflictException('Workspace slug is already taken');

    let memberUserIds: string[] = [];
    if (dto.memberEmails && dto.memberEmails.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { email: { in: dto.memberEmails } },
        select: { id: true },
      });
      memberUserIds = users.map((u) => u.id);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: dto.name, slug: dto.slug },
        });

        await tx.tenantMember.create({
          data: {
            tenantId: tenant.id,
            userId: creatorUserId,
            role: TenantRole.OWNER,
          },
        });

        if (memberUserIds.length > 0) {
          const memberData = memberUserIds.map((id) => ({
            tenantId: tenant.id,
            userId: id,
            role: TenantRole.MEMBER,
          }));

          await tx.tenantMember.createMany({ data: memberData });
        }

        return tenant;
      });
    } catch (error) {
      this.logger.error(
        `Database Transaction Failed: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to execute secure tenant transaction',
      );
    }
  }

  async findTenantsByUserId(userId: string) {
    if (!userId) {
      throw new UnauthorizedException(
        'Access denied. This token has been revoked via logout.',
      );
    }

    const tenants = await this.prisma.tenantMember.findMany({
      where: { userId: userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (tenants.length === 0) {
      return;
    }

    return tenants.map((tenant) => ({
      id: tenant.tenant.id,
      name: tenant.tenant.name,
      role: tenant.role,
    }));
  }
}
