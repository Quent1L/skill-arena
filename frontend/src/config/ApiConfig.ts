import xior, { XiorError } from 'xior'
import { convertStringDatesToJS } from '@/utils/DateUtils'
const baseURL = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin

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
    const err = new Error(apiError?.message ?? error.message, { cause: apiError?.code })
    if (apiError?.details) (err as Error & { details: unknown }).details = apiError.details
    throw err
  },
)

export default http
