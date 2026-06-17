import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  @Length(3, 50, { message: 'Name must be between 3 and 50 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Slug must be lowercase alphanumeric and dashes only (e.g., travel-ease)',
  })
  slug: string;
}
