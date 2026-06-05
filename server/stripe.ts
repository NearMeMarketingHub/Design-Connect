// Server-only — never import this file on the frontend or in any shared/ file.
// It reads secret environment variables and initialises the Stripe SDK.

import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Environment variable accessors
// ---------------------------------------------------------------------------

/** Returns the Stripe secret key, or undefined if not configured. */
export function getStripeSecretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY;
}

/** Returns the Stripe webhook signing secret, or undefined if not configured. */
export function getStripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

/** Returns the default Stripe Price ID, or undefined if not configured. */
export function getStripePriceId(): string | undefined {
  return process.env.STRIPE_PRICE_ID;
}

/**
 * Returns the Stripe publishable key, or undefined if not configured.
 * This is the ONLY key that may be shared with the frontend (via /api/stripe/config).
 * Never expose STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET to the frontend.
 */
export function getStripePublishableKey(): string | undefined {
  return process.env.STRIPE_PUBLISHABLE_KEY;
}

// ---------------------------------------------------------------------------
// Stripe client (lazy singleton)
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;

/**
 * Returns an initialised Stripe client, or null if STRIPE_SECRET_KEY is not set.
 * The app must run cleanly when this returns null — callers must guard on the result.
 */
export function getStripe(): Stripe | null {
  const key = getStripeSecretKey();
  if (!key) return null;

  if (!_stripe) {
    _stripe = new Stripe(key, {
      // Pin to the API version used when this integration was written.
      // Bump this intentionally when upgrading Stripe SDK / API behaviour.
      apiVersion: "2025-05-28.basil",
    });
  }
  return _stripe;
}

/** Returns true when STRIPE_SECRET_KEY is present and a Stripe client can be created. */
export function isStripeConfigured(): boolean {
  return !!getStripeSecretKey();
}
