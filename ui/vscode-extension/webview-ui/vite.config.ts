import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js']
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]',
            },
        },
        emptyOutDir: true,
        sourcemap: process.env.NODE_ENV !== 'production',
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        css: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            exclude: [
                'node_modules/',
                'src/test/',
                '**/*.d.ts',
                '**/*.test.{ts,tsx}',
                'src/vscode.ts',
                // Exclude JavaScript files from coverage
                '**/*.js',
                'postcss.config.js',
                'tailwind.config.js',
                'vite.config.js',
                'dist/**',
                'coverage/**'
            ],
            include: [
                'src/**/*.tsx',
                'src/**/*.ts'
            ],
            all: true
        }
    }
}); 
