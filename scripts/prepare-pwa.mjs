import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export function basePath(value = '') {
  const path = value.replace(/\/$/, '');
  if (path && !/^\/[a-zA-Z0-9_-]+$/.test(path)) throw new Error('Invalid Pages base path');
  return `${path}/`;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const lists = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
  return lists.flat();
}

export async function preparePwa(dist, base = '/') {
  const htmlPath = join(dist, 'index.html');
  let html = await readFile(htmlPath, 'utf8');
  if (base !== '/' && !html.includes(`src="${base}_expo/`)) throw new Error('Expo export does not match Pages base path');
  html = html.replace('<html lang="en">', '<html lang="he" dir="rtl">');
  html = html.replace('</head>', `
    <style id="mobile-shell">
      html, body { margin: 0; background: #000; overflow: hidden; overscroll-behavior: none; -webkit-text-size-adjust: 100%; }
      #root { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 0; overflow: hidden; direction: ltr; background: #000; }
    </style>
    <link rel="manifest" href="${base}manifest.webmanifest">
    <link rel="apple-touch-icon" href="${base}icons/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="המסגרת שלי">
    <script src="${base}pwa-register.js" defer></script>
  </head>`);
  html = html.replace('width=device-width, initial-scale=1, shrink-to-fit=no', 'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover');
  await writeFile(htmlPath, html);
  await writeFile(join(dist, '.nojekyll'), '');
  await writeFile(join(dist, 'manifest.webmanifest'), JSON.stringify({
    id: base, name: 'המסגרת שלי', short_name: 'המסגרת שלי', lang: 'he', dir: 'rtl',
    start_url: base, scope: base, display: 'standalone', background_color: '#000000', theme_color: '#000000',
    icons: [192, 512].map(size => ({ src: `${base}icons/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })),
  }, null, 2));
  // Precache only the exported app, never personal records, backups, or development previews.
  const files = (await walk(dist)).filter(path => {
    const name = relative(dist, path).replaceAll('\\', '/');
    return !['sw.js', '.nojekyll', 'metadata.json', 'iphone-preview.html', 'refresh.html'].includes(name) && !name.endsWith('.map');
  }).sort();
  const hash = createHash('sha256');
  for (const path of files) { hash.update(relative(dist, path)); hash.update(await readFile(path)); }
  const template = await readFile(new URL('../web/service-worker.js', import.meta.url), 'utf8');
  hash.update(template);
  const version = hash.digest('hex').slice(0, 16);
  const urls = files.map(path => base + relative(dist, path).replaceAll('\\', '/'));
  const worker = template.replace('__CONFIG__', JSON.stringify({ base, version, urls }));
  await writeFile(join(dist, 'sw.js'), worker);
  console.log(`Offline app prepared: ${base}, ${urls.length} files, version ${version}`);
  return { base, version, urls };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await preparePwa(join(process.cwd(), 'dist'), basePath(process.env.PAGES_BASE_PATH));
}
