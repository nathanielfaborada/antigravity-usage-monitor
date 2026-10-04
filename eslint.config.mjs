import globals from 'globals';

export default [
  { ignores: ['.vscode-test/**', 'node_modules/**'] },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      globals: { ...globals.commonjs, ...globals.node, ...globals.mocha },
      ecmaVersion: 2022,
      sourceType: 'commonjs'
    },
    rules: {
      'no-const-assign': 'error',
      'no-this-before-super': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': 'error',
      'constructor-super': 'error',
      'valid-typeof': 'error'
    }
  }
];
