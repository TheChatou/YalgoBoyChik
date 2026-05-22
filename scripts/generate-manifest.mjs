import { readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const imagesDir = path.join(projectRoot, 'images', 'YalgoBoyChik');
const files = (await readdir(imagesDir))
  .filter((name) => /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(name))
  .sort((a, b) => a.localeCompare(b, 'fr'))
  .map((name) => `images/YalgoBoyChik/${name}`);

const jsOut = `window.BOOK_IMAGES = ${JSON.stringify(files, null, 2)};\n`;
const jsonOut = `${JSON.stringify(files, null, 2)}\n`;

await mkdir(imagesDir, { recursive: true });
await writeFile(path.join(imagesDir, 'manifest.js'), jsOut, 'utf8');
await writeFile(path.join(imagesDir, 'manifest.json'), jsonOut, 'utf8');

console.log(`Generated ${files.length} image entries.`);
