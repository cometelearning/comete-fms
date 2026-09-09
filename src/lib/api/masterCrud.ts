import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from './handler';
import type { Permission } from '@/lib/types/domain';

/**
 * Small factory for the simple "master data" tables (academic years,
 * courses, batches, fee heads) which are all plain org-scoped CRUD with no
 * special financial logic. Every handler still goes through
 * requirePermission() (defense-in-depth) and Postgres RLS (0003) enforces
 * the same rule again at the database layer, and every create/update is
 * recorded in the audit trail via the write_audit_log() RPC.
 */
interface ListCreateConfig<TInsert> {
  table: string;
  readPermission: Permission;
  writePermission: Permission;
  insertSchema: z.ZodType<TInsert>;
  orderBy?: { column: string; ascending?: boolean };
  auditModule: string;
  select?: string;
}

export function createListCreateHandlers<TInsert extends Record<string, unknown>>(config: ListCreateConfig<TInsert>) {
  async function GET() {
    try {
      const session = await requirePermission(config.readPermission);
      const supabase = createClient();
      let query = supabase
        .from(config.table)
        .select(config.select ?? '*')
        .eq('org_id', session.orgId);
      if (config.orderBy) query = query.order(config.orderBy.column, { ascending: config.orderBy.ascending ?? true });
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ data });
    } catch (error) {
      return apiError(error);
    }
  }

  async function POST(request: Request) {
    try {
      const session = await requirePermission(config.writePermission);
      const body = config.insertSchema.parse(await request.json());
      const supabase = createClient();
      const { data, error } = await supabase
        .from(config.table)
        .insert({ ...body, org_id: session.orgId })
        .select()
        .single();
      if (error) throw error;
      await supabase.rpc('write_audit_log', {
        p_action: `${config.auditModule.toUpperCase()}_CREATED`,
        p_module: config.auditModule,
        p_record_id: data.id,
        p_previous_value: null,
        p_new_value: data,
        p_reason: null
      });
      return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
      return apiError(error);
    }
  }

  return { GET, POST };
}

interface ItemConfig<TUpdate> {
  table: string;
  writePermission: Permission;
  updateSchema: z.ZodType<TUpdate>;
  auditModule: string;
}

export function createItemHandlers<TUpdate extends Record<string, unknown>>(config: ItemConfig<TUpdate>) {
  async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
      const session = await requirePermission(config.writePermission);
      const body = config.updateSchema.parse(await request.json());
      const supabase = createClient();
      const { data: previous } = await supabase.from(config.table).select('*').eq('id', params.id).eq('org_id', session.orgId).single();
      const { data, error } = await supabase
        .from(config.table)
        .update(body as Record<string, unknown>)
        .eq('id', params.id)
        .eq('org_id', session.orgId)
        .select()
        .single();
      if (error) throw error;
      await supabase.rpc('write_audit_log', {
        p_action: `${config.auditModule.toUpperCase()}_UPDATED`,
        p_module: config.auditModule,
        p_record_id: params.id,
        p_previous_value: previous ?? null,
        p_new_value: data,
        p_reason: null
      });
      return NextResponse.json({ data });
    } catch (error) {
      return apiError(error);
    }
  }

  return { PATCH };
}
