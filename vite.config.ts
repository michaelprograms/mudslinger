/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));
const gitHash = (() => {
    try { return execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(); }
    catch { return 'unknown'; }
})();

export default defineConfig({
    publicDir: 'static/public',
    build: {
        outDir: 'static/public',
        emptyOutDir: false,
        copyPublicDir: false,
    },
    define: {
        __APP_VERSION__: JSON.stringify(version),
        __APP_BUILD__: JSON.stringify(gitHash),
    },
    test: {
        include: ['test/**/*.test.ts'],
        environment: 'node',
    },
});
