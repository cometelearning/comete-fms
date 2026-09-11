import { z } from 'zod';
import { createItemHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

export const { PATCH } = createItemHandlers({
  table: 'classes',
  writePermission: 'masters.write',
  updateSchema,
  auditModule: 'classes'
});
