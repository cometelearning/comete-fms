/**
 * Hand-written baseline Supabase Database type.
 *
 * Once the schema is deployed to a real Supabase project, regenerate the
 * exact types with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/types/database.ts
 * (see README.md "Keeping types in sync"). Until then, this loose-but-valid
 * shape keeps the Supabase client generic happy while the strongly-typed
 * interfaces the app actually codes against live in ./domain.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: AnyRow;
        Insert: AnyRow;
        Update: AnyRow;
      };
    };
    Views: {
      [key: string]: {
        Row: AnyRow;
      };
    };
    Functions: {
      assign_fee_to_student: {
        Args: { p_student_id: string; p_fee_structure_id: string };
        Returns: string;
      };
      create_student_fee: {
        Args: { p_student_id: string; p_items: AnyRow[]; p_installments: AnyRow[] };
        Returns: string;
      };
      update_student_fee: {
        Args: { p_student_fee_account_id: string; p_items: AnyRow[]; p_installments: AnyRow[] };
        Returns: string;
      };
      record_payment: {
        Args: {
          p_student_fee_account_id: string;
          p_installment_id: string | null;
          p_amount: number;
          p_payment_mode: string;
          p_payment_date: string;
          p_reference_number: string | null;
          p_remarks: string | null;
          p_idempotency_key: string;
        };
        Returns: AnyRow;
      };
      cancel_receipt: {
        Args: { p_receipt_id: string; p_reason: string };
        Returns: AnyRow;
      };
      grant_discount: {
        Args: {
          p_student_fee_account_id: string;
          p_installment_id: string | null;
          p_discount_type: string;
          p_value: number;
          p_reason: string;
        };
        Returns: string;
      };
      reverse_discount: {
        Args: { p_discount_id: string; p_reason: string };
        Returns: AnyRow;
      };
      generate_student_code: {
        Args: { p_org_id: string };
        Returns: string;
      };
      write_audit_log: {
        Args: {
          p_action: string;
          p_module: string;
          p_record_id: string | null;
          p_previous_value: AnyRow | null;
          p_new_value: AnyRow | null;
          p_reason: string | null;
        };
        Returns: string;
      };
      bootstrap_organization: {
        Args: { p_name: string; p_email: string | null; p_phone: string | null; p_address: string | null };
        Returns: string;
      };
    };
  };
}
