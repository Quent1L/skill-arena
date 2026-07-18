import xior, { XiorError } from 'xior'
import { convertStringDatesToJS } from '@/utils/DateUtils'
import { NETWORK_ERROR, isTransientStatus } from '@/utils/HttpErrors'
export const apiBaseURL = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin

const baseURL = apiBaseURL

const http = xior.create({
  baseURL,
  credentials: 'include',
})

http.interceptors.response.use(
  (response) => {
    response.data = convertStringDatesToJS(response.data)

    return response
  },
  async (error: XiorError) => {
    console.error('HTTP Error:', error.message, error.response)
    const apiError = error.response?.data?.error
    const status = error.response?.status
    // With no application code, a missing status or >= 500 is a transient failure:
    // mark it so callers never mistake it for an auth refusal.
    const cause = apiError?.code ?? (isTransientStatus(status) ? NETWORK_ERROR : undefined)
    const err = new Error(apiError?.message ?? error.message, { cause })
    if (apiError?.details) (err as Error & { details: unknown }).details = apiError.details
    ;(err as Error & { status?: number }).status = status
    throw err
  },
)

export default http
