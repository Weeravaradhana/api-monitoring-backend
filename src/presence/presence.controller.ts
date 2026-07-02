import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { Public } from '../auth/decorators/public.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('workspaces')
class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Public()
  @Get(':workspaceId/members')
  async getMembers(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.presenceService.getTenantMembers(workspaceId);
  }

  @Get()
  async getNotificationData(@GetUser('sub') userId: string) {
    return this.presenceService.getNotificationData(userId);
  }
}

export default PresenceController;
