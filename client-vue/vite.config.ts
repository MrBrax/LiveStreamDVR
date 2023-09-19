/// <reference types="vitest" />
// @ts-nocheck
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { gitDescribeSync } from 'git-describe'
import { VitePWA } from 'vite-plugin-pwa'

process.env.VITE_APP_VERSION = process.env.npm_package_version
process.env.VITE_APP_BUILDDATE = new Date().toISOString()
process.env.VITE_APP_GIT_HASH = gitDescribeSync(__dirname, {
  customArguments: ['--abbrev=40'],
}).hash

// https://vitejs.dev/config/
export default defineConfig({
  // define: {
  //   '__VUE_OPTIONS_API__': false,
  // },
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
        id: 'com.lsdvr.app',
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
        navigateFallbackDenylist: [
          /\/api\//,
          /\/socket\//,
          /\/cache\//,
          /\/vodplayer\//,
          /\/vods\//,
          /\/saved_vods\//,
          /\/saved_clips\//,
          /\/cache\//,
          /\/logs\//,
          /\/about\/license/,
        ],
        mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
        globPatterns: [
          '**/*.{js,css,html,ico,png,jpg,webp,svg,webmanifest,xml,txt}',
        ],
      },

    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@common': path.resolve(__dirname, '..', 'common'),
      '@server': path.resolve(__dirname, '..', 'server', 'src'),
    },
    dedupe: ['vue'],
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
      // '/vodplayer': 'http://localhost:8080',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
  // optimizeDeps: {
  //   include: [
  //     'vue',
  //     'vue-router',
  //     'pinia',
  //     // 'vue-axios',
  //   ],
  //   link: [
  //     'vue',
  //     'vue-router',
  //     'pinia',
  //     // 'vue-axios',
  //   ],
  // },
  build: {
    // sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // 'axios': ['axios'],
          // 'date-fns': ['date-fns'],
          'vue': [
            'vue',
            'vue-router',
            'pinia',
            'vue-i18n',
            'vue-observe-visibility',
          ],
          'fonts': [
            '@fontsource/poppins',
            '@fontsource/roboto',
            '@fontsource/roboto-condensed',
          ],
          'icons': [
            '@fortawesome/free-solid-svg-icons',
            '@fortawesome/free-brands-svg-icons',
            '@fortawesome/vue-fontawesome',
            '@fortawesome/fontawesome-svg-core'
          ],
          'settings': [
            './src/views/SettingsView.vue',
            './src/views/Settings/SettingsAddChannel.vue',
            './src/views/Settings/SettingsChannels.vue',
            './src/views/Settings/SettingsClientSettings.vue',
            './src/views/Settings/SettingsConfig.vue',
            './src/views/Settings/SettingsFavourites.vue',
            './src/views/Settings/SettingsKeyvalue.vue',
            './src/views/Settings/SettingsNotifications.vue',
            './src/views/Settings/SettingsTips.vue',
          ],
          'chart': [
            'chart.js',
            'vue-chartjs',
          ],
        }
      }
    }
  }
})
