module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
  ],
  env: {
    browser: true,
    es2021: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // TypeScript rules
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // React rules
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    // General rules
    'no-console': 'warn',
    'prefer-const': 'warn',
  },
  overrides: [
    {
      files: ['*.tsx'],
      rules: {
        // Allow JSX in TSX files
      },
    },
  ],
};