module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        "plugin:vue/vue3-recommended",
        // "eslint:recommended",
        "@vue/typescript/recommended",
        "prettier",
        // "@vue/prettier",
        // "@vue/prettier/@typescript-eslint"
    ],
    parser: "vue-eslint-parser",
    parserOptions: {
        ecmaVersion: 2022,
        parser: "@typescript-eslint/parser",
        sourceType: "module",
        project: "./tsconfig.app.json",
        // extraFileExtensions: [".vue"],
    },
    plugins: [
        "deprecation",
    ],
    rules: {
        "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
        "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
        "deprecation/deprecation": "warn",
        /*"indent": [
            "warning",
            4,
        ],
        */
        "linebreak-style": [
            "error",
            "unix",
        ],
        "quotes": [
            "error",
            "double",
        ],
        "semi": [
            "error",
            "always",
        ],
        "vue/html-indent": ["error", 4, {
            "attribute": 1,
            "baseIndent": 1,
            "closeBracket": 0,
            "alignAttributesVertically": true,
            "ignores": []
        }]
    },
    ignorePatterns: ['.eslintrc.js']
};
