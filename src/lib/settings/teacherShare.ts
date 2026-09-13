// Shared constant for the "% of a teacher's computed tuition share that
// actually goes to the teacher" org-wide policy (settings key
// 'teacher_share_payout_percent') - kept in its own module (rather than
// only inside the API route) so both the API route and the Settings page
// server component can import it without pulling in route-handler code.
export const DEFAULT_TEACHER_SHARE_PAYOUT_PERCENT = 60;
