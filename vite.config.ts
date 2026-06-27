/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));
const gitHash = (() => {
    try { return execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(); }
    catch { return 'unknown'; }
})();

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        base: '/play/',
        publicDir: 'static/public',
        build: {
            outDir: 'static/public',
            emptyOutDir: false,
            copyPublicDir: false,
        },
        define: {
            __APP_VERSION__: JSON.stringify(version),
            __APP_BUILD__:   JSON.stringify(gitHash),
            __REPO_URL__:    JSON.stringify(env.VITE_REPO_URL ?? 'https://github.com/michaelprograms/mudslinger'),
            __MUD_URL__:     JSON.stringify(env.VITE_MUD_URL  ?? 'ws://localhost:5000'),
            __MUD_NAME__:    JSON.stringify(env.VITE_MUD_NAME ?? 'My MUD'),
        },
        test: {
            include: ['test/**/*.test.ts'],
            environment: 'node',
        },
    };
});
