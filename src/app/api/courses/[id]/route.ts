import { z } from 'zod';
import { createItemHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  class_standard: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

export const { PATCH } = createItemHandlers({
  table: 'courses',
  writePermission: 'masters.write',
  updateSchema,
  auditModule: 'courses'
});
