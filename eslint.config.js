// ESLint flat config — o guarda-corpo principal é o react-hooks
// (exhaustive-deps), dado o volume de useEffect/rAF/refs do projeto.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Vite HMR: componentes exportados junto com helpers quebram o fast
      // refresh do arquivo — aviso, não erro (padrão do template Vite).
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // O projeto usa `_` como convenção de descarte em callbacks (map etc.)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  }
);
