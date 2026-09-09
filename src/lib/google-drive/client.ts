import 'server-only';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptToken, encryptToken } from './tokenCrypto';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}

export function getGoogleAuthUrl(state: string) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // ensures a refresh_token is returned even on re-connect
    scope: SCOPES,
    state
  });
}

export async function exchangeCodeAndStore(orgId: string, code: string, connectedByUserId: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      'GOOGLE_NO_REFRESH_TOKEN: Google did not return a refresh token. Please remove COMETE LEARNING\'s access at https://myaccount.google.com/permissions and try connecting again.'
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  const admin = createAdminClient();

  // Create (or reuse) the root folder structure: COMETE LEARNING - FEE MANAGEMENT / Receipts
  const drive = google.drive({ version: 'v3', auth: client });
  const rootFolderId = await ensureFolder(drive, 'COMETE LEARNING - FEE MANAGEMENT', null);

  const { error } = await admin
    .from('google_drive_accounts')
    .update({
      connected_email: profile.email,
      refresh_token_encrypted: encryptToken(tokens.refresh_token),
      access_token_encrypted: tokens.access_token ? encryptToken(tokens.access_token) : null,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      root_folder_id: rootFolderId,
      status: 'CONNECTED',
      last_error: null,
      connected_by: connectedByUserId,
      connected_at: new Date().toISOString()
    })
    .eq('org_id', orgId);
  if (error) throw error;

  return { email: profile.email };
}

export async function disconnectDrive(orgId: string) {
  const admin = createAdminClient();
  await admin
    .from('google_drive_accounts')
    .update({ status: 'DISCONNECTED', refresh_token_encrypted: null, access_token_encrypted: null })
    .eq('org_id', orgId);
}

/** Returns an authenticated Drive client for the org, or null if not connected. */
async function getDriveClientForOrg(orgId: string) {
  const admin = createAdminClient();
  const { data: account } = await admin.from('google_drive_accounts').select('*').eq('org_id', orgId).single();
  if (!account || account.status !== 'CONNECTED' || !account.refresh_token_encrypted) return null;

  const client = oauthClient();
  client.setCredentials({ refresh_token: decryptToken(account.refresh_token_encrypted) });
  return { drive: google.drive({ version: 'v3', auth: client }), account };
}

async function ensureFolder(drive: ReturnType<typeof google.drive>, name: string, parentId: string | null): Promise<string> {
  const q = [`name = '${name.replace(/'/g, "\\'")}'`, "mimeType = 'application/vnd.google-apps.folder'", 'trashed = false'];
  if (parentId) q.push(`'${parentId}' in parents`);
  const existing = await drive.files.list({ q: q.join(' and '), fields: 'files(id, name)', spaces: 'drive' });
  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : undefined },
    fields: 'id'
  });
  return created.data.id!;
}

/**
 * Uploads a file to <pathSegments...>/<fileName> inside the org's connected
 * Drive root, creating any missing folders along the way. Throws on failure
 * - callers catch this and record it as PENDING/FAILED without touching the
 * underlying financial record (spec #23).
 */
export async function uploadFile(orgId: string, pathSegments: string[], fileName: string, bytes: Uint8Array, mimeType: string) {
  const ctx = await getDriveClientForOrg(orgId);
  if (!ctx) throw new Error('DRIVE_NOT_CONNECTED');
  const { drive, account } = ctx;

  let parentId = account.root_folder_id as string;
  for (const segment of pathSegments) {
    parentId = await ensureFolder(drive, segment, parentId);
  }

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [parentId] },
    media: { mimeType, body: bufferToStream(bytes) },
    fields: 'id, webViewLink'
  });

  return { fileId: res.data.id!, webViewLink: res.data.webViewLink ?? null };
}

/** Receipts/<AcademicYear>/<Month>/<fileName>.pdf - the layout spec #21 asks for. */
export async function uploadReceiptPdf(orgId: string, academicYearLabel: string, monthLabel: string, fileName: string, bytes: Uint8Array) {
  return uploadFile(orgId, ['Receipts', academicYearLabel, monthLabel], fileName, bytes, 'application/pdf');
}

export async function testDriveConnection(orgId: string): Promise<{ connected: boolean; email?: string; error?: string }> {
  try {
    const ctx = await getDriveClientForOrg(orgId);
    if (!ctx) return { connected: false };
    await ctx.drive.about.get({ fields: 'user' });
    return { connected: true, email: ctx.account.connected_email };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function bufferToStream(bytes: Uint8Array) {
  return Readable.from(Buffer.from(bytes));
}
