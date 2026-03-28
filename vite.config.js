import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function staticDirsPlugin() {
  return {
    name: 'static-dirs-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = decodeURIComponent(rawUrl.split('?')[0]);

        if (!pathname.startsWith('/data/') && !pathname.startsWith('/images/')) {
          next();
          return;
        }

        const filePath = path.join(server.config.root, pathname.slice(1));

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          next();
          return;
        }

        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const root = process.cwd();
      copyDirSync(path.join(root, 'data'), path.join(root, 'dist', 'data'));
      copyDirSync(path.join(root, 'images'), path.join(root, 'dist', 'images'));
      copyDirSync(path.join(root, 'icons'), path.join(root, 'dist', 'icons'));
      if (fs.existsSync(path.join(root, 'manifest.json'))) {
        fs.copyFileSync(path.join(root, 'manifest.json'), path.join(root, 'dist', 'manifest.json'));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), staticDirsPlugin()],
});
