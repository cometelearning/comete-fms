import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError, UnauthenticatedError } from '@/lib/auth/session';

/**
 * Maps known error types to safe, user-facing HTTP responses and logs the
 * real error server-side. Per spec #42 (Error Handling), raw technical
 * errors (Postgres codes, stack traces, provider error bodies) must never
 * reach the browser - callers of this function should route every API
 * failure through here rather than returning error.message directly.
 */
export function apiError(error: unknown): NextResponse {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: 'AUTH_REQUIRED', message: 'Please sign in to continue.' }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: 'FORBIDDEN', message: 'You do not have permission to do this.' }, { status: 403 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Some of the submitted information is invalid.', details: error.flatten() },
      { status: 400 }
    );
  }

  const raw = error instanceof Error ? error.message : String(error);

  // A handful of known, safe-to-surface business errors raised explicitly by
  // our own Postgres RPC functions (see supabase/migrations/0005). Anything
  // else is logged and replaced with a generic message.
  const knownBusinessErrors: Record<string, string> = {
    FEE_ALREADY_ASSIGNED: 'This fee structure is already assigned to this student.',
    FEE_STRUCTURE_NOT_FOUND_OR_INACTIVE: 'That fee structure could not be found or is inactive.',
    FEE_STRUCTURE_HAS_NO_INSTALLMENTS: 'That fee structure has no installment plan configured.',
    STUDENT_NOT_FOUND: 'That student could not be found.',
    STUDENT_FEE_ACCOUNT_NOT_FOUND: 'That student does not have a fee account.',
    INVALID_AMOUNT: 'Please enter an amount greater than zero.',
    RECEIPT_NOT_FOUND: 'That receipt could not be found.',
    RECEIPT_ALREADY_CANCELLED: 'This receipt has already been cancelled.',
    REASON_REQUIRED: 'Please provide a reason.',
    DISCOUNT_NOT_FOUND_OR_ALREADY_REVERSED: 'That discount could not be found or was already reversed.',
    TARGET_NOT_FOUND: 'The fee account or installment could not be found.',
    FEE_STRUCTURE_NEEDS_AT_LEAST_ONE_FEE_HEAD: 'Add at least one fee head before saving.',
    FEE_STRUCTURE_NEEDS_AT_LEAST_ONE_INSTALLMENT: 'Add at least one installment before saving.',
    FEE_NEEDS_AT_LEAST_ONE_FEE_HEAD: 'Add at least one fee head before saving.',
    FEE_NEEDS_AT_LEAST_ONE_INSTALLMENT: 'Add at least one installment before saving.',
    INVALID_TOTAL_FEE: 'The total fee must be greater than zero.',
    INSTALLMENTS_DO_NOT_MATCH_TOTAL: 'The installment amounts must add up to exactly the total fee.',
    FEE_ALREADY_ASSIGNED_DUP: 'This fee structure is already assigned to this student.',
    STUDENT_MISSING_COURSE_OR_YEAR: 'Set the Course and Academic Year on the student profile before entering a fee.',
    CANNOT_EDIT_FEE_WITH_PAYMENTS: 'This fee already has a payment recorded against it, so it cannot be edited. Add a new fee entry instead.',
    CANNOT_EDIT_FEE_WITH_DISCOUNTS: 'This fee already has a discount recorded against it, so it cannot be edited. Add a new fee entry instead.',
    INVALID_DISCOUNT_TYPE: 'Please choose a valid discount type.',
    CANNOT_DISABLE_SELF: 'You cannot disable your own account.',
    INVALID_ROLE: 'That role does not exist.',
    STUDENT_HAS_FEE_RECORDS: 'This student has a fee account, payment or receipt on record and cannot be permanently deleted. Deactivate the student instead to keep their financial history intact.',
    marks_obtained_within_total: 'Marks obtained cannot exceed total marks.',
    ux_fee_heads_single_tuition_head: 'Another fee head is already marked as the Tuition Fee head. Unmark it first before marking a different one.'
  };

  for (const code of Object.keys(knownBusinessErrors)) {
    if (raw.includes(code)) {
      return NextResponse.json({ error: code, message: knownBusinessErrors[code] }, { status: 422 });
    }
  }

  if (raw.includes('INVALID_DISCOUNT_AMOUNT')) {
    return NextResponse.json(
      { error: 'INVALID_DISCOUNT_AMOUNT', message: 'The discount amount must be greater than zero and cannot exceed the current fee amount.' },
      { status: 422 }
    );
  }

  // eslint-disable-next-line no-console
  console.error('[api-error]', error);

  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message: 'Something went wrong on our end. The action was not completed. Please try again.' },
    { status: 500 }
  );
}
