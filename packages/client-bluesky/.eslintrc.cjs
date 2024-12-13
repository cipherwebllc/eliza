module.exports = {
    extends: ["../../.eslintrc.json", "plugin:@typescript-eslint/recommended"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
        sourceType: "module",
        ecmaVersion: 2020,
    },
    plugins: ["@typescript-eslint"],
    ignorePatterns: ["dist/*", "node_modules/*"],
    rules: {
        "@typescript-eslint/no-explicit-any": "warn",
    },
};
