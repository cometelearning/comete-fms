import { z } from 'zod';
import { createListCreateHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const insertSchema = z.object({
  class_id: z.string().uuid(),
  name: z.string().min(1)
});

// Subject Master, "based on classes" per the user's explicit request - every
// subject belongs to exactly one Class. select embeds classes(name) so the
// list screen can show the class name without a second round trip.
export const { GET, POST } = createListCreateHandlers({
  table: 'subjects',
  readPermission: 'masters.read',
  writePermission: 'masters.write',
  insertSchema,
  select: '*, classes(name)',
  orderBy: { column: 'name', ascending: true },
  auditModule: 'subjects'
});
