import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: {
        compilerOptions: {
            moduleResolution: 'NodeNext',
            composite: false,
            preserveSymlinks: true,
            verbatimModuleSyntax: true
        }
    },
    clean: true,
    sourcemap: true,
    target: 'es2021',
    platform: 'node',
    external: [
        'fs',
        'path',
        'url',
        'http',
        'https',
        'crypto',
        'node:fs',
        'node:path',
        'node:url',
        'node:http',
        'node:https',
        'node:crypto'
    ]
});
