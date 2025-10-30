import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'fca-theme'
const VALID_THEMES = ['dark', 'light']

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
})

function sanitizeTheme(value) {
  return VALID_THEMES.includes(value) ? value : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const fallback = 'dark'
    if (typeof window === 'undefined') {
      if (typeof document !== 'undefined') document.documentElement.dataset.theme = fallback
      return fallback
    }
    const stored = sanitizeTheme(localStorage.getItem(STORAGE_KEY))
    const prefers = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const initial = sanitizeTheme(stored || prefers)
    document.documentElement.dataset.theme = initial
    return initial
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const listener = (event) => {
      if (localStorage.getItem(STORAGE_KEY)) return
      setTheme(event.matches ? 'dark' : 'light')
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener?.('change', listener)
    return () => mq.removeEventListener?.('change', listener)
  }, [])

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next) => setTheme(sanitizeTheme(next)),
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
