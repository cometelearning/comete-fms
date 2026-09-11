// Strongly-typed shapes the application codes against. These mirror the
// Postgres schema in supabase/migrations exactly - keep them in sync if you
// change a migration.

export type RoleKey = 'super_admin' | 'admin' | 'accountant' | 'viewer' | string;

export interface Profile {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  role_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  org_id: string;
  key: RoleKey;
  name: string;
  is_system: boolean;
}

export interface AcademicYear {
  id: string;
  org_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ClassMaster {
  id: string;
  org_id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Course {
  id: string;
  org_id: string;
  name: string;
  // Frozen at whatever single class a course had before migration 0016 -
  // Course Master no longer reads or writes this column. A course's actual
  // class(es) live in the course_classes join table (many-to-many); see
  // CourseClass below. Kept only for historical reference, never
  // destructively removed.
  class_id: string | null;
  // Auto-maintained, comma-joined list of every class this course is
  // currently tagged to via course_classes (e.g. "Class 11, Class 12"),
  // kept in sync by database triggers (migrations 0011 + 0016). Used for
  // *display only* (student profile, Student Record report, exports) -
  // never for filtering, since text equality can't correctly match a
  // multi-class course. Do not write it directly.
  class_standard: string | null;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

// Many-to-many link between a Course and every Class it's tagged to
// (migration 0016) - lets the office reuse one course across several
// classes instead of creating a duplicate per class.
export interface CourseClass {
  id: string;
  org_id: string;
  course_id: string;
  class_id: string;
  created_at: string;
}

export interface Branch {
  id: string;
  org_id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Board {
  id: string;
  org_id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

// Batch is just a type label (e.g. Morning / Evening) - course_id /
// academic_year_id / branch_id exist in the database (from an earlier
// design) but are unused and nullable; Batch Master no longer sets or
// requires them.
export interface Batch {
  id: string;
  org_id: string;
  name: string;
  course_id: string | null;
  academic_year_id: string | null;
  branch_id: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface FeeHead {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Student {
  id: string;
  org_id: string;
  student_code: string;
  admission_number: string | null;
  name: string;
  guardian_name: string | null;
  student_mobile: string | null;
  parent_mobile: string | null;
  student_email: string | null;
  parent_email: string | null;
  address: string | null;
  course_id: string | null;
  batch_id: string | null;
  academic_year_id: string | null;
  branch_id: string | null;
  board_id: string | null;
  school_name: string | null;
  last_year_percentage: string | null;
  date_of_birth: string | null;
  admission_date: string;
  status: 'ACTIVE' | 'INACTIVE';
  remarks: string | null;
  parent_remarks: string | null; // column kept (never destructively removed) but no longer shown/editable in the UI - student profile now has a single Remarks box
  created_at: string;
  updated_at: string;
}

export interface FeeStructure {
  id: string;
  org_id: string;
  name: string;
  academic_year_id: string;
  course_id: string;
  batch_id: string | null;
  total_fee: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface FeeStructureItem {
  id: string;
  fee_structure_id: string;
  fee_head_id: string;
  amount: number;
}

export interface FeeStructureInstallmentTemplate {
  id: string;
  fee_structure_id: string;
  seq_no: number;
  label: string;
  amount: number;
  due_date: string;
}

export interface StudentFeeAccount {
  id: string;
  org_id: string;
  student_id: string;
  fee_structure_id: string;
  academic_year_id: string;
  total_fee: number;
  status: 'ACTIVE' | 'CLOSED';
  created_at: string;
}

export type InstallmentComputedStatus = 'PAID' | 'PARTIALLY_PAID' | 'DUE' | 'OVERDUE' | 'WAIVED';

export interface InstallmentStatusRow {
  id: string;
  org_id: string;
  student_fee_account_id: string;
  seq_no: number;
  label: string;
  amount: number;
  due_date: string;
  paid_amount: number;
  waived_amount: number;
  effective_amount: number;
  outstanding_amount: number;
  status: InstallmentComputedStatus;
  days_overdue: number;
}

export type FeeOverallStatus = 'FULLY_PAID' | 'OVERDUE' | 'PARTIALLY_PAID' | 'PENDING';

export interface StudentFeeSummaryRow {
  student_fee_account_id: string;
  org_id: string;
  student_id: string;
  fee_structure_id: string;
  academic_year_id: string;
  account_status: 'ACTIVE' | 'CLOSED';
  total_fee: number;
  discount_total: number;
  net_fee: number;
  paid_total: number;
  outstanding_total: number;
  overdue_amount: number;
  overdue_installments: number;
  next_due_amount: number | null;
  next_due_date: string | null;
  next_due_installment_id: string | null;
  overall_status: FeeOverallStatus;
}

export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'OTHER';

export interface Payment {
  id: string;
  org_id: string;
  student_fee_account_id: string;
  student_id: string;
  payment_date: string;
  amount: number;
  payment_mode: PaymentMode;
  reference_number: string | null;
  remarks: string | null;
  status: 'COMPLETED' | 'CANCELLED';
  created_by: string;
  created_at: string;
}

export interface Receipt {
  id: string;
  org_id: string;
  payment_id: string;
  receipt_number: string;
  academic_year_id: string;
  issued_at: string;
  status: 'ACTIVE' | 'CANCELLED';
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  pdf_status: 'PENDING' | 'STORED' | 'FAILED';
  drive_file_id: string | null;
  created_by: string;
  created_at: string;
}

export interface Discount {
  id: string;
  org_id: string;
  student_fee_account_id: string;
  installment_id: string | null;
  discount_type: 'FIXED' | 'PERCENTAGE';
  value: number;
  amount: number;
  reason: string;
  status: 'ACTIVE' | 'REVERSED';
  granted_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  module: string;
  record_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
  created_at: string;
}

export interface LedgerEntry {
  org_id: string;
  student_id: string;
  student_fee_account_id: string;
  entry_at: string;
  particulars: string;
  debit: number;
  credit: number;
  ref_type: string;
  ref_id: string;
  balance: number;
}

// Gated by students.read/students.write (see migration 0014) rather than a
// dedicated permission - PTM notes are student-linked personal data, same
// sensitivity as the student profile itself, and reusing the existing keys
// avoids a permissions-catalog backfill for every already-provisioned role.
export interface PtmRecord {
  id: string;
  org_id: string;
  student_id: string;
  ptm_date: string;
  attended: boolean;
  parent_remarks: string | null;
  counsellor_remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  STUDENTS_READ: 'students.read',
  STUDENTS_WRITE: 'students.write',
  MASTERS_READ: 'masters.read',
  MASTERS_WRITE: 'masters.write',
  FEE_STRUCTURES_READ: 'fee_structures.read',
  FEE_STRUCTURES_WRITE: 'fee_structures.write',
  STUDENT_FEES_READ: 'student_fees.read',
  STUDENT_FEES_WRITE: 'student_fees.write',
  PAYMENTS_COLLECT: 'payments.collect',
  RECEIPTS_READ: 'receipts.read',
  RECEIPTS_CANCEL: 'receipts.cancel',
  DISCOUNTS_GRANT: 'discounts.grant',
  OUTSTANDING_VIEW: 'outstanding.view',
  REPORTS_VIEW: 'reports.view',
  EXPORTS_RUN: 'exports.run',
  AUDIT_VIEW: 'audit.view',
  USERS_MANAGE: 'users.manage',
  SETTINGS_MANAGE: 'settings.manage'
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
