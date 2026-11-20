// Finishes the static online build in /docs: data files + .nojekyll (GitHub Pages serves /docs as it is).
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('docs');
const src = path.resolve('apps/terminal/demo-data');
fs.mkdirSync(path.join(dir, 'demo-data'), { recursive: true });
for (const f of ['instruments.json', 'prices.json']) fs.copyFileSync(path.join(src, f), path.join(dir, 'demo-data', f));
const hist = {};
for (const f of fs.readdirSync(path.join(src, 'history'))) hist[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(src, 'history', f), 'utf8'));
fs.writeFileSync(path.join(dir, 'demo-data', 'history.json'), JSON.stringify(hist));
fs.writeFileSync(path.join(dir, '.nojekyll'), '');
console.log('static site ready in docs/ (', fs.readdirSync(dir).join(', '), ')');
