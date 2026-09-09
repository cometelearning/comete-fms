import { z } from 'zod';
import { createListCreateHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const insertSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

export const { GET, POST } = createListCreateHandlers({
  table: 'fee_heads',
  readPermission: 'masters.read',
  writePermission: 'masters.write',
  insertSchema,
  orderBy: { column: 'name', ascending: true },
  auditModule: 'fee_heads'
});
