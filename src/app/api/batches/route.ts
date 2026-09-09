import { z } from 'zod';
import { createListCreateHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const insertSchema = z.object({
  name: z.string().min(1),
  course_id: z.string().uuid(),
  academic_year_id: z.string().uuid()
});

export const { GET, POST } = createListCreateHandlers({
  table: 'batches',
  readPermission: 'masters.read',
  writePermission: 'masters.write',
  insertSchema,
  orderBy: { column: 'name', ascending: true },
  auditModule: 'batches'
});
