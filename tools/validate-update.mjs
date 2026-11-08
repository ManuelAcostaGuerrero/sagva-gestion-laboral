import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {transformSync} from 'esbuild';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function validateUpdateSource(filename,source) {
  if(filename.endsWith('.json') || filename.endsWith('.webmanifest')) {JSON.parse(source);return;}
  if(filename.startsWith('client/')) {
    transformSync(source,{loader:filename.endsWith('.jsx')?'jsx':'js',sourcefile:filename,target:'es2022'});
  } else {
    const checked=spawnSync(process.execPath,['--check','--input-type=module'],{input:source,encoding:'utf8',windowsHide:true});
    if(checked.error) throw checked.error;
    if(checked.status!==0) throw new Error(checked.stderr.trim() || 'Sintaxis JavaScript inválida.');
  }
}
export function validateUpdate(ref=null) {
  const git=args=>execFileSync('git.exe',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
  const files=(ref?git(['ls-tree','-r','--name-only',ref]):git(['ls-files'])).trim().split(/\r?\n/)
    .filter(name=> /^(client\/src\/|server\/src\/|shared\/|tools\/).+\.(jsx|js|mjs)$/.test(name)
      || ['package.json','package-lock.json','server/package.json','client/package.json','client/public/manifest.webmanifest'].includes(name));
  const failures=[];
  for(const name of files) {
    try {validateUpdateSource(name,ref?git(['show',`${ref}:${name}`]):fs.readFileSync(path.join(root,name),'utf8'));}
    catch(error) {failures.push(`${name}: ${error.message}`);}
  }
  if(failures.length) throw new Error(`Código ${ref || 'local'} no válido. No iniciar ni migrar.\n${failures.join('\n')}`);
  console.log(`Sintaxis y manifiestos correctos: ${files.length} archivos (${ref || 'local'}).`);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {const index=process.argv.indexOf('--ref');validateUpdate(index>=0?process.argv[index+1]:null);}
  catch(error) {console.error(error.message);process.exitCode=1;}
}
