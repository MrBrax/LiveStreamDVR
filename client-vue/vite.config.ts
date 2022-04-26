import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { gitDescribeSync } from 'git-describe'

process.env.VITE_APP_VERSION = process.env.npm_package_version
process.env.VITE_APP_BUILDDATE = new Date().toISOString()
process.env.VITE_APP_GIT_HASH = gitDescribeSync().hash

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@common': path.resolve(__dirname, '..', 'common'),
    },
  },
})
