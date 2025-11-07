import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@/data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@/auth': fileURLToPath(new URL('./src/auth', import.meta.url)),
      '@/lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@/services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@/utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@/entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@/Pages': fileURLToPath(new URL('./src/Pages', import.meta.url)),
      // Force external deps resolution for files outside this package
      'lucide-react': fileURLToPath(new URL('./node_modules/lucide-react', import.meta.url)),
      'date-fns': fileURLToPath(new URL('./node_modules/date-fns', import.meta.url)),
      'framer-motion': fileURLToPath(new URL('./node_modules/framer-motion', import.meta.url)),
      recharts: fileURLToPath(new URL('./node_modules/recharts', import.meta.url)),
      'react-router-dom': fileURLToPath(new URL('./node_modules/react-router-dom', import.meta.url)),
      react: fileURLToPath(new URL('./node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('./node_modules/react-dom', import.meta.url)),
    },
  },
})
