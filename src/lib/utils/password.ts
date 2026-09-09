import 'server-only';
import { randomBytes } from 'crypto';

/** A random, readable temporary password for a newly-created user to change on first login. */
export function generateTempPassword(): string {
  const raw = randomBytes(9).toString('base64').replace(/[+/=]/g, '');
  return `${raw.slice(0, 10)}#${Math.floor(Math.random() * 90 + 10)}`;
}
