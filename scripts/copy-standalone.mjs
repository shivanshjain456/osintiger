import fs from 'fs';
import path from 'path';

const root = process.cwd();
const standaloneStatic = path.join(root, '.next', 'standalone', '.next', 'static');
const nextStatic = path.join(root, '.next', 'static');
const standalonePublic = path.join(root, '.next', 'standalone', 'public');
const publicDir = path.join(root, 'public');

try {
  if (fs.existsSync(path.join(root, '.next', 'standalone'))) {
    if (fs.existsSync(nextStatic)) {
      fs.mkdirSync(path.dirname(standaloneStatic), { recursive: true });
      fs.cpSync(nextStatic, standaloneStatic, { recursive: true });
    }
    if (fs.existsSync(publicDir)) {
      fs.cpSync(publicDir, standalonePublic, { recursive: true });
    }
    console.log('[build] Standalone assets copied successfully.');
  }
} catch (err) {
  console.warn('[build] Warning during standalone copy:', err.message);
}
