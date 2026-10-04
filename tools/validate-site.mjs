import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// Prevent publishing an empty or incomplete result after an upstream failure.
const output = resolve('notablog-starter/public');
for (const filename of ['index.html', 'side-project.html']) {
  const path = resolve(output, filename);
  const html = readFileSync(path, 'utf8');
  if (statSync(path).size < 1000 || !/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
    throw new Error(`Generated page is incomplete: ${filename}`);
  }
}
const sitemap = readFileSync(resolve(output, 'sitemap.xml'), 'utf8');
if (!sitemap.includes('<urlset') || !sitemap.includes('<loc>')) {
  throw new Error('Generated sitemap is empty or invalid');
}
console.log('Generated homepage, portfolio, and sitemap passed validation.');
