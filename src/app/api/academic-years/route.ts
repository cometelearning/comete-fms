import { z } from 'zod';
import { createListCreateHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const insertSchema = z.object({
  name: z.string().min(2),
  start_date: z.string(),
  end_date: z.string(),
  is_current: z.boolean().optional()
});

export const { GET, POST } = createListCreateHandlers({
  table: 'academic_years',
  readPermission: 'masters.read',
  writePermission: 'masters.write',
  insertSchema,
  orderBy: { column: 'start_date', ascending: false },
  auditModule: 'academic_years'
});
