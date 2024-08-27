require("@mds-bd/eslint-config/patch/modern-module-resolution");

module.exports = {
	parser: "@typescript-eslint/parser",
	env: { browser: true, node: true, es6: true },
	extends: ["airbnb", "prettier"],
	parserOptions: {
		ecmaVersion: 2021,
		sourceType: "module",
		tsconfigRootDir: __dirname,
	},
	rules: {
    "prettier/prettier": ["error"]
  	},
	overrides: [
		{
			files: "*.json",
			parser: "jsonc-eslint-parser",
			rules: {},
		},
	],
};
