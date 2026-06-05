// Pure billing-display helper — computes a human-readable status object from
// company billing fields.  No Stripe SDK calls happen here; this is safe to
// use anywhere on the server that has access to the Company record.
//
// NOTE: This file is server-side only.  If similar display logic is needed in
// the browser, write a standalone duplicate in the component (no imports from
// server/stripe.ts or this file).

export type BillingDisplayVariant = "active" | "warning" | "destructive" | "secondary" | "outline";

export interface BillingDisplayState {
  label: string;
  variant: BillingDisplayVariant;
  description: string;
  isStripeActive: boolean;
  inGracePeriod: boolean;
}

interface CompanyBillingFields {
  subscriptionStatus?: string | null;
  billingType?: string | null;
  stripePaymentStatus?: string | null;
  stripeGraceEndsAt?: Date | string | null;
}

/**
 * Returns a display-safe billing state object derived from company billing fields.
 *
 * Display mapping:
 *  active  + current              → Active
 *  active  + past_due + grace     → Past Due / Grace Period
 *  suspended + past_due/unpaid    → Suspended for Payment
 *  free                           → Free / Demo Access
 *  prepaid                        → Prepaid / Included Access
 *  cancelled                      → Cancelled
 *  expired                        → Expired
 *  in_app billing + no stripe     → Stripe Not Configured
 *  fallback                       → Unknown
 *
 * IMPORTANT — Stripe status naming:
 *   Stripe's API uses "canceled" (one L) for subscription/payment statuses.
 *   Our internal stripePaymentStatus column uses "cancelled" (two L's) to match
 *   the rest of the app's convention.  When mapping Stripe webhook data to this
 *   column in a future phase, explicitly convert "canceled" → "cancelled".
 *   Do NOT assume Stripe API status strings equal our internal values.
 */
export function getCompanyBillingDisplayState(
  company: CompanyBillingFields
): BillingDisplayState {
  const status = company.subscriptionStatus ?? "free";
  const billingType = company.billingType ?? "manual";
  const paymentStatus = company.stripePaymentStatus ?? null;

  // Grace period: active when graceEndsAt is set and in the future
  const graceEnd = company.stripeGraceEndsAt
    ? new Date(company.stripeGraceEndsAt)
    : null;
  const inGracePeriod = !!graceEnd && graceEnd > new Date();

  // --- Manual / non-Stripe access statuses ---
  if (status === "free") {
    return {
      label: "Free / Demo Access",
      variant: "secondary",
      description: "This company has free or demo access to the platform.",
      isStripeActive: false,
      inGracePeriod: false,
    };
  }

  if (status === "prepaid") {
    return {
      label: "Prepaid / Included Access",
      variant: "active",
      description: "Access is prepaid or included as part of a service arrangement.",
      isStripeActive: false,
      inGracePeriod: false,
    };
  }

  if (status === "cancelled") {
    return {
      label: "Cancelled",
      variant: "outline",
      description: "This company's access has been cancelled.",
      isStripeActive: false,
      inGracePeriod: false,
    };
  }

  if (status === "expired") {
    return {
      label: "Expired",
      variant: "destructive",
      description: "This company's access period has expired.",
      isStripeActive: false,
      inGracePeriod: false,
    };
  }

  if (status === "suspended") {
    const isPastDueOrUnpaid =
      paymentStatus === "past_due" || paymentStatus === "unpaid";
    return {
      label: isPastDueOrUnpaid ? "Suspended for Payment" : "Suspended",
      variant: "destructive",
      description: isPastDueOrUnpaid
        ? "Access is suspended due to an unpaid invoice."
        : "This company's access has been suspended by an administrator.",
      isStripeActive: false,
      inGracePeriod: false,
    };
  }

  // --- Active status — may have Stripe overlay ---
  if (status === "active") {
    // Stripe in-app billing but not yet configured
    if (billingType === "in_app" && !paymentStatus) {
      return {
        label: "Stripe Not Configured",
        variant: "warning",
        description:
          "Billing type is set to in-app but Stripe is not yet configured for this company.",
        isStripeActive: false,
        inGracePeriod: false,
      };
    }

    // Active + past_due + within grace window
    if (paymentStatus === "past_due" && inGracePeriod) {
      return {
        label: "Past Due / Grace Period",
        variant: "warning",
        description: `Payment is past due. Access continues until the grace period ends${graceEnd ? ` on ${graceEnd.toLocaleDateString()}` : ""}.`,
        isStripeActive: true,
        inGracePeriod: true,
      };
    }

    // Active + action_required (e.g. SCA authentication needed)
    if (paymentStatus === "action_required") {
      return {
        label: "Payment Action Required",
        variant: "warning",
        description:
          "A payment action is required to continue your subscription.",
        isStripeActive: true,
        inGracePeriod: false,
      };
    }

    // Healthy active
    return {
      label: "Active",
      variant: "active",
      description: "Subscription is active and in good standing.",
      isStripeActive: true,
      inGracePeriod: false,
    };
  }

  // Fallback for any unrecognised status
  return {
    label: status.replace(/_/g, " "),
    variant: "outline",
    description: "Unknown billing state.",
    isStripeActive: false,
    inGracePeriod: false,
  };
}
