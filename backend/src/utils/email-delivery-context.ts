import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Better Auth runs the sendResetPassword hook through `runInBackgroundOrAwait`, which
 * awaits the hook but swallows whatever it throws. A delivery failure therefore cannot
 * bubble up through `auth.api.requestPasswordReset`.
 *
 * Callers that must surface the failure (the admin "resend reset link" action) wrap the
 * call in `withStrictEmailDelivery`; the hook then reports the error into the store
 * instead of throwing, and the wrapper rethrows it once the call returns.
 *
 * The public forgot-password flow deliberately runs outside this context: exposing the
 * delivery status there would tell an attacker whether an account exists.
 */
interface StrictEmailDelivery {
  error: unknown;
}

const strictDelivery = new AsyncLocalStorage<StrictEmailDelivery>();

export async function withStrictEmailDelivery<T>(fn: () => Promise<T>): Promise<T> {
  const delivery: StrictEmailDelivery = { error: null };
  const result = await strictDelivery.run(delivery, fn);

  if (delivery.error) {
    throw delivery.error;
  }

  return result;
}

/**
 * Hands an email failure to the surrounding `withStrictEmailDelivery` caller.
 * Returns false when nobody is listening, meaning the caller must handle it itself.
 */
export function reportEmailDeliveryFailure(error: unknown): boolean {
  const delivery = strictDelivery.getStore();
  if (!delivery) return false;

  delivery.error ??= error;
  return true;
}
