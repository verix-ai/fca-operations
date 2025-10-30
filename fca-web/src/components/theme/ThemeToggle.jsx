import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider.jsx'
import { Button } from '@/components/ui/button'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Activate ${isDark ? 'light' : 'dark'} mode`}
      borderRadius="1.5rem"
      className={`theme-toggle rounded-2xl ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
