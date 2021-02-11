process.env.VUE_APP_VERSION = process.env.npm_package_version;

module.exports = {
    // publicPath: '/test/',
    publicPath: process.env.BASE_URL,
    // publicPath: './',
    assetsDir: "assets",
    pwa: {
        manifestPath: "manifest/manifest.json",
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
};
