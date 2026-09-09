import { z } from 'zod';
import { createItemHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_current: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

export const { PATCH } = createItemHandlers({
  table: 'academic_years',
  writePermission: 'masters.write',
  updateSchema,
  auditModule: 'academic_years'
});
