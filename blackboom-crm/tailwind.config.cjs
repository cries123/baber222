// Tailwind is compiled at build time (build.mjs). Only classes used in src/ end up in public/app.css.
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{html,jsx}'],
    theme: {
        extend: {
            // Warm "leather" neutrals instead of cold zinc; gold, red and green retuned to the brand
            colors: {
                black: '#000000',
                white: '#F2EEE6',
                zinc: { 50: '#F7F4EE', 100: '#EDE8DF', 200: '#DAD3C7', 300: '#BFB7A9', 400: '#A39C90', 500: '#7F786D', 600: '#5E584F', 700: '#3D3833', 800: '#2A2622', 900: '#161412', 950: '#100E0D' },
                gold: { DEFAULT: '#C9A13B', dim: '#9C7C2A', hi: '#DDB955' },
                yellow: { 400: '#DDB955', 500: '#C9A13B', 600: '#9C7C2A' },
                red: { 200: '#F0C4BE', 300: '#E8A49D', 400: '#D9776E', 500: '#C4554B', 600: '#A63E35', 700: '#8C2F2A', 800: '#6E2420', 900: '#3A1512' },
                green: { 200: '#C6E3CC', 300: '#A6D3AF', 400: '#8CC79A', 500: '#5FAE73', 600: '#3F8A55', 700: '#2F6A41', 800: '#22502F', 900: '#14301D' },
                bone: '#EDE6D6',
                ink: '#1A1714',
                oxblood: '#8C2F2A',
            },
            fontFamily: {
                sans: ['"Hanken Grotesk"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
                display: ['"Big Shoulders Display"', '"Arial Narrow"', 'sans-serif'],
                mono: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
            },
            borderRadius: { DEFAULT: '8px', md: '8px', lg: '10px', xl: '12px', '2xl': '16px' },
        },
    },
};
