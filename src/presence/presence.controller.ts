import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('workspaces')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Public()
  @Get(':workspaceId/members')
  async getMembers(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.presenceService.getTenantMembers(workspaceId);
  }
}
