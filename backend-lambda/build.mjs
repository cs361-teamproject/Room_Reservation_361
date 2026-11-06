// Bundles each function in functions.json into dist/<name>/index.mjs (handler: index.handler).
//   node build.mjs              build all
//   node build.mjs rooms health build some
//   node build.mjs --watch      rebuild on change (pairs with HOT_RELOAD=1 deploy)
import { cp, readFile } from 'node:fs/promises';
import * as esbuild from 'esbuild';

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const only = args.filter((a) => !a.startsWith('--')).map((a) => a.trim());

const manifest = JSON.parse(await readFile('functions.json', 'utf8'));
const known = manifest.functions.map((f) => f.name);
const unknown = only.filter((n) => !known.includes(n));
if (unknown.length) {
  console.error(`Unknown function(s): ${unknown.join(', ')}. Known: ${known.join(', ')}`);
  process.exit(1);
}
const targets = only.length ? only : known;

for (const name of targets) {
  // Files are overwritten in place, never deleted: with HOT_RELOAD LocalStack mounts this directory
  const outdir = `dist/${name}`;

  /** @type {import('esbuild').BuildOptions} */
  const options = {
    entryPoints: { index: `src/functions/${name}/handler.ts` },
    outdir,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    minify: true,
    sourcemap: true,
    logLevel: 'warning',
    // Some dependencies are CommonJS and call require() for Node built-ins
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  };

  if (name === 'migrate') {
    await cp('drizzle/migrations', `${outdir}/migrations`, { recursive: true });
  }

  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
  } else {
    await esbuild.build(options);
  }
  console.log(`built ${outdir}/index.mjs`);
}

if (watch) console.log('watching for changes...');
