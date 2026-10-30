/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{svelte,js,ts}'],
	theme: {
		extend: {
			colors: {
				brand: {
					gold: '#e5a01d',
					goldLight: '#fbc02d',
					goldDark: '#8c5205'
				}
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				mono: ['JetBrains Mono', 'monospace']
			}
		}
	},
	plugins: []
};
