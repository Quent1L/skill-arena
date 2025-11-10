import { format } from 'date-fns'

const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:?\d{2}|Z)$/
const localDateRegex = /^\d{4}-\d{2}-\d{2}$/
const arrayOfDateStringRegex = [isoDateRegex, localDateRegex]

export function isDateString(str: string) {
  return arrayOfDateStringRegex.some((regex) => regex.test(str))
}
/**
 * Fonction qui convertit les dates au format string en date javascript
 * @param data  données à convertir
 * @returns données converties
 */
export function convertStringDatesToJS<T>(data: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function convertStringDatesToJS(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => convertStringDatesToJS(item))
    } else if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        if (Object.hasOwn(data, key)) {
          if (typeof data[key] === 'string' && isDateString(data[key])) {
            data[key] = new Date(data[key])
          } else if (typeof data[key] === 'object') {
            data[key] = convertStringDatesToJS(data[key])
          }
        }
      }
    }
    return data
  }
  return convertStringDatesToJS(data) as T
}

export function dateToStringDDMMYYYY(date: Date | undefined | null) {
  if (!date) return date
  return format(date, 'dd/MM/yyyy')
}
export function dateToStringDDMMYYYYHHMMSS(date: Date | undefined) {
  if (!date) return date
  return format(date, 'dd/MM/yyyy HH:mm:ss')
}
export function dateToStringDDMMYYYYHHMM(date: Date | undefined) {
  if (!date) return date
  return format(date, 'dd/MM/yyyy HH:mm')
}

export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  return format(date, 'dd/MM/yyyy')
}

export function calculateDuration(startDate: string | Date, endDate: string | Date): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate

  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 1) {
    return '1 jour'
  } else if (diffDays < 7) {
    return `${diffDays} jours`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    const remainingDays = diffDays % 7
    if (remainingDays === 0) {
      return weeks === 1 ? '1 semaine' : `${weeks} semaines`
    } else {
      return `${weeks} semaine${weeks > 1 ? 's' : ''} et ${remainingDays} jour${remainingDays > 1 ? 's' : ''}`
    }
  } else {
    const months = Math.floor(diffDays / 30)
    return months === 1 ? '1 mois' : `${months} mois`
  }
}
