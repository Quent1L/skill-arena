import xior, {  XiorError } from 'xior'
import { convertStringDatesToJS } from '@/utils/DateUtils'
const baseURL = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

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
    throw new Error(error.response?.data?.error?.message ?? error.message)
  },
)

export default http
