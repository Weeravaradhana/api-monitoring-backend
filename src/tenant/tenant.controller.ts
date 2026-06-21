import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface JwtUser {
  sub: string;
  tenantId: string;
  role: string;
}

@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async createOrganization(
    @Body() dto: CreateTenantDto,
    @GetUser('sub') userId: string,
  ) {
    const tenant = await this.tenantService.createTenantWithMembers(
      dto,
      userId,
    );

    return {
      success: true,
      message: 'Organization registered successfully in Prisma backend',
      data: tenant,
    };
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async getUserTenants(@GetUser() user: JwtUser) {
    const userId = user.sub;
    return await this.tenantService.findTenantsByUserId(userId);
  }
}
