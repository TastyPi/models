import { createContext, createEffect, createSignal } from 'solid-js'

export type UrlSetter = (key: string, value: string | null) => void
export const UrlSyncContext = createContext<UrlSetter>()

export function createUrlSync(): UrlSetter {
  const [params, setParams] = createSignal<Record<string, string>>({}, { equals: false })

  createEffect(() => {
    const urlParams = new URLSearchParams(params())
    const qs = urlParams.toString()
    history.replaceState(null, '', qs ? '?' + qs : window.location.pathname)
  })

  return (key, value) => {
    setParams(prev => {
      const next = { ...prev }
      if (value === null) delete next[key]
      else next[key] = value
      return next
    })
  }
}
