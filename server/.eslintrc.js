module.exports = {
    "env": {
        // "browser": true,
        "es2021": true,
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module",
        "project": "./tsconfig.json",
    },
    "plugins": [
        "@typescript-eslint",
        "deprecation",
        // "import",
    ],
    "rules": {
        "indent": [
            "error",
            4,
        ],
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
        "no-constructor-return": "error",
        "no-template-curly-in-string": "warn",
        "require-await": "warn",
        "comma-dangle": ["error", {
            "arrays": "always-multiline",
            "objects": "always-multiline",
            "imports": "always-multiline",
            "exports": "always-multiline",
            "functions": "never",
        }],
        "deprecation/deprecation": "warn",
        "no-var": "error",
        "prefer-const": "error",
        "@typescript-eslint/consistent-type-imports": "error"
        // "import/no-relative-parent-imports": "error",
    },
    ignorePatterns: ['.eslintrc.js']
};
