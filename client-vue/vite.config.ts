/// <reference types="vitest" />
// @ts-nocheck
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { gitDescribeSync } from 'git-describe'
import { VitePWA } from 'vite-plugin-pwa'

process.env.VITE_APP_VERSION = process.env.npm_package_version
process.env.VITE_APP_BUILDDATE = new Date().toISOString()
process.env.VITE_APP_GIT_HASH = gitDescribeSync().hash

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      includeAssets: [
        'favicon.ico',
        'manifest/apple-touch-icon.png',
        'manifest/safari-pinned-tab.svg',
      ],
      manifest: {
        name: 'LiveStreamDVR',
        short_name: 'LSDVR',
        description: 'Record your favorite live streams',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'manifest/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'manifest/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },

      // ignore api calls
      workbox: {
        navigateFallbackDenylist: [/\/api\//],
        // mode: 'development',
      },

    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@common': path.resolve(__dirname, '..', 'common'),
    },
  },
  server: {
    port: 8081,
    proxy: {
      '/api': 'http://localhost:8080',
      '/saved_clips': 'http://localhost:8080',
      '/saved_vods': 'http://localhost:8080',
      '/vods': 'http://localhost:8080',
      '/logs': 'http://localhost:8080',
      '/cache': 'http://localhost:8080',
      '/vodplayer': 'http://localhost:8080',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  }
})
