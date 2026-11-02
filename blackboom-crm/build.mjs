// Production build. Compiles src/ into public/ so visitors download finished files:
//   src/app.jsx  -> public/app.js   (JSX compiled and minified by esbuild)
//   src/app.css  -> public/app.css  (Tailwind, only the classes the app uses, minified)
//   src/index.html -> public/index.html (with a cache-busting version on both)
// Runs automatically before `firebase deploy` (see firebase.json "predeploy").
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const started = Date.now();

await build({
    entryPoints: ['src/app.jsx'],
    outfile: 'public/app.js',
    bundle: false, // Firebase is imported from Google's CDN at runtime; React, GSAP etc. load as globals
    format: 'esm',
    target: ['es2020'],
    loader: { '.jsx': 'jsx' },
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    minify: true,
    legalComments: 'none',
    logLevel: 'warning',
});

execFileSync(process.execPath, [
    require.resolve('tailwindcss/lib/cli.js'),
    '-c', 'tailwind.config.cjs', '-i', 'src/app.css', '-o', 'public/app.css', '--minify',
], { stdio: ['ignore', 'ignore', 'inherit'] });

const js = fs.readFileSync('public/app.js');
const css = fs.readFileSync('public/app.css');
const version = createHash('sha256').update(js).update(css).digest('hex').slice(0, 10);
fs.writeFileSync('public/index.html', fs.readFileSync('src/index.html', 'utf8').replaceAll('__BUILD__', version));

const kb = (b) => `${(b.length / 1024).toFixed(0)} KB`;
console.log(`built ${version} in ${Date.now() - started} ms: app.js ${kb(js)}, app.css ${kb(css)}`);
