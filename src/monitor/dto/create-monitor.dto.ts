import { z } from 'zod';
import { $Enums } from '@prisma/client';
import HttpMethod = $Enums.HttpMethod;

export const createMonitorSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  url: z.string().url('Include valid address pattern'),
  method: z.nativeEnum(HttpMethod).default(HttpMethod.GET),
  interval: z.number().int().min(10, 'At least include 10s').default(60),
  timeout: z.number().int().min(1).max(60).default(30),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().optional(),
});

export const UpdateMonitorSchema = createMonitorSchema.partial();

export type CreateMonitorDto = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorDto = z.infer<typeof UpdateMonitorSchema>;
