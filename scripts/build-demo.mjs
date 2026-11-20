// Packs the browser-only demo: dist-demo/index.html (full document, for local testing),
// dist-demo/page.html (page content for hosts that wrap it, e.g. Artifacts) and dist-demo/demo-data/.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('apps/terminal/dist-demo');
const js = fs.readFileSync(path.join(dir, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(dir, 'app.css'), 'utf8');
const src = path.resolve('apps/terminal/demo-data');
fs.mkdirSync(path.join(dir, 'demo-data'), { recursive: true });
for (const f of ['instruments.json', 'prices.json']) fs.copyFileSync(path.join(src, f), path.join(dir, 'demo-data', f));
// merge the per-symbol history files into one
const hist = {};
for (const f of fs.readdirSync(path.join(src, 'history'))) hist[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(src, 'history', f), 'utf8'));
fs.writeFileSync(path.join(dir, 'demo-data', 'history.json'), JSON.stringify(hist));

const body = `<title>BrokerOS Terminal</title>
<style>:root{color-scheme:dark}${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
fs.writeFileSync(path.join(dir, 'page.html'), body);
fs.writeFileSync(path.join(dir, 'index.html'),
  `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"></head><body>${body}</body></html>`);
for (const f of ['app.js', 'app.css']) fs.rmSync(path.join(dir, f));
console.log('demo built:', (fs.statSync(path.join(dir, 'page.html')).size / 1024).toFixed(0), 'KB page');
