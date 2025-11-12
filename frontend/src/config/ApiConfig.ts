import xior, { merge, XiorError } from 'xior'
import { useAuth } from '@/composables/useAuth'
import { convertStringDatesToJS } from '@/utils/DateUtils'

const http = xior.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  credentials: 'include',
})

http.interceptors.response.use(
  (response) => {
    response.data = convertStringDatesToJS(response.data)

    return response
  },
  async (error: XiorError) => {
    console.error('HTTP Error:', error.message, error.response)
    throw new Error(error.response?.data?.error ?? error.message)
  },
)

export default http
