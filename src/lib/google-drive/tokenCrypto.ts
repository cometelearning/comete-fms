import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption for the Google OAuth refresh token at rest in
 * Postgres. The key never leaves the server (GOOGLE_TOKEN_ENCRYPTION_KEY env
 * var, generate with `openssl rand -hex 32`). Format stored in the DB:
 * "<ivHex>:<authTagHex>:<cipherTextHex>".
 */
function getKey(): Buffer {
  const hex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY is not configured (expected a 64-character hex string / 32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptToken(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
