import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{
		// Carpetas y estáticos que no necesitan revisión
		ignores: [
			'node_modules/**',
			'dist/**',
			'public/**',
			'projects/**',
			'billiard-app-windows/**'
		]
	},
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				extraFileExtensions: ['.svelte']
			}
		}
	},
	{
		rules: {
			// Permite catch (e) {} limpios sin advertencias
			'no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
			],
			'no-empty': ['warn', { allowEmptyCatch: true }],

			'no-constant-binary-expression': 'warn',
			'no-redeclare': 'warn',
			'no-prototype-builtins': 'warn',
			'no-cond-assign': 'warn',
			'no-useless-assignment': 'warn',
			'no-useless-escape': 'warn',
			'no-control-regex': 'warn',
			'no-unsafe-finally': 'warn',

			'svelte/require-each-key': 'warn'
		}
	}
);