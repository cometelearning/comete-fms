import { z } from 'zod';
import { createListCreateHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const insertSchema = z.object({
  name: z.string().min(1),
  class_standard: z.string().optional(),
  description: z.string().optional()
});

export const { GET, POST } = createListCreateHandlers({
  table: 'courses',
  readPermission: 'masters.read',
  writePermission: 'masters.write',
  insertSchema,
  orderBy: { column: 'name', ascending: true },
  auditModule: 'courses'
});
