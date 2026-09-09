import { z } from 'zod';
import { createItemHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  course_id: z.string().uuid().optional(),
  academic_year_id: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

export const { PATCH } = createItemHandlers({
  table: 'batches',
  writePermission: 'masters.write',
  updateSchema,
  auditModule: 'batches'
});
