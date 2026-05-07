import tseslint from 'typescript-eslint';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import templateParser from '@angular-eslint/template-parser';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  { files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended, sonarjs.configs.recommended],
    plugins: { '@angular-eslint': angular },
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/void-use': 'off'
    }
  },
  { files: ['**/*.html'],
    languageOptions: { parser: templateParser },
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: {
      ...angularTemplate.configs.recommended.rules
    }
  }
);
