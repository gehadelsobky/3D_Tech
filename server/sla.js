/**
 * Response-time SLA for form submissions.
 *
 * 24 hours is the turnaround promised to customers in the site copy
 * ("24hr Quote Turnaround", the success message, and the confirmation email),
 * so the admin panel, the analytics dashboard, and the overdue-alert job all
 * measure against this one value. Change it here and every surface follows.
 */
export const SLA_HOURS = 24;
