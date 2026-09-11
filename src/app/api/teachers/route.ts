import { z } from 'zod';
import { createListCreateHandlers } from '@/lib/api/masterCrud';

export const runtime = 'nodejs';

const insertSchema = z.object({
  name: z.string().min(1)
});

// Teacher Master - name + status only, per the user's explicit request ("I
// will put the teacher name"). A plain reference list, not a login/user
// account - see migration 0020 for why this stays out of Users/Roles.
export const { GET, POST } = createListCreateHandlers({
  table: 'teachers',
  readPermission: 'masters.read',
  writePermission: 'masters.write',
  insertSchema,
  orderBy: { column: 'name', ascending: true },
  auditModule: 'teachers'
});
