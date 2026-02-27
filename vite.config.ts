/**
 * @module ViteConfig
 * Build, dev server, and test configuration for Tadpole OS frontend.
 * Includes manual vendor chunk splitting for cache efficiency
 * and Vitest integration with jsdom + v8 coverage.
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting for optimal cache efficiency.
         * Vendor deps are stable and rarely change — separating them
         * prevents full-bundle re-downloads on app code updates.
         */
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react'],
          'vendor-state': ['zustand'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    alias: {
      'react-dom/test-utils': 'react-dom/test-utils',
    },
    exclude: ['**/node_modules/**', '**/dist/**', '**/setup.ts', 'tests/e2e/**'],
    deps: {
      optimizer: {
        web: {
          include: ['react-dom', 'react-dom/client']
        }
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx', 'server/**/*.ts'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'tests/**']
    }
  },
})
