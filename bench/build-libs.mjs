// node bench/build-libs.mjs  ->  bench/dist/libs.js  (needs npm install in this folder first)
import { build } from 'esbuild'; import { fileURLToPath } from 'node:url'; import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
await build({ entryPoints: [join(here, 'libs-entry.js')], bundle: true, minify: true, format: 'iife', globalName: 'LIBS', outfile: join(here, 'dist/libs.js'), platform: 'browser', logLevel: 'info', absWorkingDir: here });
