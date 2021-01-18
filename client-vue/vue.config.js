module.exports = {
    // publicPath: '/test/',
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
                changeOrigin: true
            }
        }
    }
}