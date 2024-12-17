import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: {
        compilerOptions: {
            moduleResolution: 'NodeNext',
            composite: false,
            preserveSymlinks: true
        }
    },
    clean: true,
    sourcemap: true,
    target: 'es2021',
    platform: 'node'
});
