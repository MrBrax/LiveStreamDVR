const { defineConfig } = require("@vue/cli-service");
process.env.VUE_APP_VERSION = process.env.npm_package_version;

module.exports = defineConfig({
    // publicPath: '/test/',
    publicPath: process.env.BASE_URL,

    // publicPath: './',
    assetsDir: "assets",

    pwa: {
        manifestPath: "manifest.json",
        themeColor: "#ffffff",
        msTileColor: "#000000",
        iconPaths: {
            favicon32: "manifest/favicon-32x32.png",
            favicon16: "manifest/favicon-16x16.png",
            faviconSVG: "manifest/favicon.svg",
            appleTouchIcon: "manifest/apple-touch-icon.png",
            maskIcon: "manifest/safari-pinned-tab.svg",
            msTileImage: "manifest/mstile-150x150.png",
        },
    },

    devServer: {
        port: 8081,
        proxy: {
            "^/api": {
                target: "http://[::1]:8080",
                // timeout: 6000,
                logLevel: "debug",
                // pathRewrite: { '^/api': '/api' },
                secure: false,
                ws: false,
                changeOrigin: true,
            },
            "^/vods": {
                target: "http://[::1]:8080",
                // timeout: 6000,
                logLevel: "debug",
                // pathRewrite: { '^/api': '/api' },
                secure: false,
                ws: false,
                changeOrigin: true,
            },
        },
    },

    lintOnSave: false,
});
