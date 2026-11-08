import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8',windowsHide:true}).trim();

export default defineConfig({
  define: {__SAGVA_BUILD_COMMIT__:JSON.stringify(commit)},
  plugins: [react(),{
    name:'sagva-local-version',
    generateBundle(){this.emitFile({type:'asset',fileName:'local-version.json',source:JSON.stringify({commit,stage:'INT-001'})});}
  }],
  server: {
    port: 5183,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:4010', changeOrigin: true } },
    allowedHosts: [
      '.trycloudflare.com'
    ]
  }
});
