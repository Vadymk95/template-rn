/** @type {import('tailwindcss').Config} */
module.exports = {
    // Product code only: a class name in a test file or a test helper would compile into a rule no
    // screen uses. A new folder under src/ is scanned until it is negated here;
    // scripts/tailwind-scan.test.mjs pins both directions.
    content: ['./src/**/*.{ts,tsx}', '!./src/**/*.test.{ts,tsx}', '!./src/test/**'],
    presets: [require('nativewind/preset')],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: 'hsl(var(--primary))',
                'primary-foreground': 'hsl(var(--primary-foreground))',
                muted: 'hsl(var(--muted))',
                'muted-foreground': 'hsl(var(--muted-foreground))',
                border: 'hsl(var(--border))',
                destructive: 'hsl(var(--destructive))'
            }
        }
    },
    plugins: []
};
