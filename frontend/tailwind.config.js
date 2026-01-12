/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Solarized Light Theme
                solarized: {
                    base03: '#002b36',
                    base02: '#073642',
                    base01: '#586e75',
                    base00: '#657b83',
                    base0: '#839496',
                    base1: '#93a1a1',
                    base2: '#eee8d5',
                    base3: '#fdf6e3',
                    yellow: '#b58900',
                    orange: '#cb4b16',
                    red: '#dc322f',
                    magenta: '#d33682',
                    violet: '#6c71c4',
                    blue: '#268bd2',
                    cyan: '#2aa198',
                    green: '#859900',
                },
            },
            backgroundColor: {
                'primary': '#fdf6e3',
                'secondary': '#eee8d5',
                'highlight': '#f7f1e0',
            },
            textColor: {
                'primary': '#586e75',
                'secondary': '#657b83',
                'emphasis': '#073642',
            },
            borderColor: {
                'default': '#e3dcc8',
                'solarized': '#e3dcc8',
            },
            boxShadow: {
                'solarized': '0 1px 3px rgba(0, 43, 54, 0.08), 0 1px 2px rgba(0, 43, 54, 0.08)',
                'solarized-lg': '0 10px 15px -3px rgba(0, 43, 54, 0.08), 0 4px 6px -2px rgba(0, 43, 54, 0.08)',
            },
        },
    },
    plugins: [],
}
