import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto, userId: string) {
    if (!userId) {
      throw new UnauthorizedException(
        'Access denied. This token has been revoked via logout.',
      );
    }

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existingTenant) {
      throw new ConflictException(`The slug '${dto.slug}' is already taken.`);
    }

    try {
      return this.prisma.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
