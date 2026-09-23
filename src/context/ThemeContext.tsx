import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'velo-theme'
const LEGACY_STORAGE_KEY = 'bettershot-theme'

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved
      }
    } catch (e) {
      console.warn('[ThemeContext] Failed to read theme from localStorage:', e)
    }
    return 'dark' // Dark by default
  })

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme === 'system') {
      return getSystemTheme()
    }
    return theme
  })

  // Apply resolved theme to HTML root element
  const applyThemeToDOM = (resolved: ResolvedTheme) => {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      root.setAttribute('data-theme', 'dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
      root.setAttribute('data-theme', 'light')
      root.style.colorScheme = 'light'
    }
  }

  // Update resolvedTheme when theme changes or system preference changes
  useEffect(() => {
    let activeResolved: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme
    setResolvedTheme(activeResolved)
    applyThemeToDOM(activeResolved)

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        const nextResolved: ResolvedTheme = e.matches ? 'dark' : 'light'
        setResolvedTheme(nextResolved)
        applyThemeToDOM(nextResolved)
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  // Listen for IPC theme change events from other Electron windows
  useEffect(() => {
    if (window.electronAPI?.onThemeChange) {
      const unsubscribe = window.electronAPI.onThemeChange((incomingTheme: string) => {
        if (incomingTheme === 'dark' || incomingTheme === 'light' || incomingTheme === 'system') {
          console.log('[ThemeContext] Received cross-window theme update:', incomingTheme)
          setThemeState(incomingTheme)
          try {
            localStorage.setItem(STORAGE_KEY, incomingTheme)
          } catch (e) {
            console.warn('[ThemeContext] Failed to update localStorage:', e)
          }
        }
      })
      return () => unsubscribe()
    }
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch (e) {
      console.warn('[ThemeContext] Failed to save theme to localStorage:', e)
    }
    // Broadcast to other windows
    if (window.electronAPI?.sendThemeChange) {
      window.electronAPI.sendThemeChange(newTheme)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
