/**
 * Marker carried on `Error.cause` for transient failures: unreachable network,
 * restarting backend, 5xx, timeout, CORS.
 *
 * A failure marked NETWORK_ERROR must never be read as a logout: only an explicit
 * authentication response (401) can mean that.
 */
export const NETWORK_ERROR = 'NETWORK_ERROR'

export function isNetworkError(err: unknown): boolean {
  return (err as { cause?: string })?.cause === NETWORK_ERROR
}

/**
 * An HTTP response is "transient" when it expresses no application decision:
 * missing status (fetch/CORS/DNS failure) or server error >= 500.
 */
export function isTransientStatus(status: number | undefined): boolean {
  return status === undefined || status >= 500
}
