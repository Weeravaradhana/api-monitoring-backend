import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
    const tenant = await this.tenantService.create(dto, userId);

    return {
      success: true,
      message: 'Organization registered successfully in Prisma backend',
      data: tenant,
    };
  }
}
