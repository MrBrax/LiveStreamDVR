module.exports = {
    env: {
        // "browser": true,
        es2021: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended-type-checked",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
    },
    plugins: [
        "@typescript-eslint",
        "deprecation",
        // "import",
    ],
    rules: {
        // "indent": [
        //     "error",
        //     4,
        // ],
        "linebreak-style": ["error", "unix"],
        // quotes: ["error", "double"],
        semi: ["error", "always"],
        "no-constructor-return": "error",
        "no-template-curly-in-string": "warn",
        "require-await": "warn",
        "comma-dangle": [
            "error",
            {
                arrays: "always-multiline",
                objects: "always-multiline",
                imports: "always-multiline",
                exports: "always-multiline",
                functions: "never",
            },
        ],
        "deprecation/deprecation": "warn",
        "no-var": "error",
        "prefer-const": "error",
        "@typescript-eslint/consistent-type-imports": "error",
        // "log-module": "warn",
        "no-throw-literal": "error",
        // "import/no-relative-parent-imports": "error",
        "no-use-before-define": "warn",
        "@typescript-eslint/naming-convention": [
            "error",
            {
                selector: "variable",
                format: ["camelCase", "UPPER_CASE"],
                leadingUnderscore: "allow",
                trailingUnderscore: "allow",
            },
            {
                selector: "typeLike",
                format: ["PascalCase"],
            },
            {
                selector: "enumMember",
                format: ["PascalCase"],
            },
        ],
        "@typescript-eslint/member-ordering": ["error"],
        "@typescript-eslint/explicit-member-accessibility": ["error"],
        "@typescript-eslint/no-base-to-string": "error",
    },
    ignorePatterns: [".eslintrc.js"],
};
