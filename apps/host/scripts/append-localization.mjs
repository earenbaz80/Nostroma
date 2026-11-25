import ts from 'typescript';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const catalog=JSON.parse(await readFile('src/locales/en.json','utf8')),extra=new Set();
/* Every English set i18n.ts merges, not just en.json: a text that already lives in fix-en.json or chat-en.json is not new, and giving it a second id here is
   how "Picture reader" and "No model is loaded." ended up as two keys (tests/english-catalog-duplicates.test.mjs). */
const english=[...((await readFile('src/lib/i18n.ts','utf8')).matchAll(/from '\.\.\/locales\/([a-z0-9-]+\.json)'/g))].map(match=>match[1]);
const known=new Set();for(const file of english)for(const text of Object.values(JSON.parse(await readFile(`src/locales/${file}`,'utf8'))))known.add(text);
function add(text){text=text.trim();if(text&&/[a-zA-Z]{2}/.test(text)&&!known.has(text))extra.add(text);}
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='locales')await scan(path);}else if(/\.tsx?$/.test(path)){const source=await readFile(path,'utf8'),sf=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(sf)==='tr'&&node.arguments[0]&&(ts.isStringLiteral(node.arguments[0])||ts.isNoSubstitutionTemplateLiteral(node.arguments[0])))add(node.arguments[0].text);ts.forEachChild(node,visit);};visit(sf);}}}
await scan('src');
try{const native=await(await fetch('http://127.0.0.1:5161/api/native')).json();for(const family of native.catalog?.families??[]){add(family.about);for(const size of family.sizes)add(size.about);}}catch{}
/* The next free number, not the key count: ids are unified away over time (s1150 and s3273 were), and a count then hands out an id a file already uses and
   silently overwrites that string. */
let index=Math.max(0,...Object.keys(catalog).map(key=>Number(/^s(\d+)$/.exec(key)?.[1])||0))+1;
const added={};for(const text of [...extra].sort()){const id=`s${String(index++).padStart(4,'0')}`;if(id in catalog)throw new Error(`${id} already holds a string: the numbering is not free`);catalog[id]=text;added[id]=text;}
await writeFile('src/locales/en.json',JSON.stringify(catalog,null,2)+'\n');
const extraPath='docs/checkpoints/before-language-and-model-fixes-2026-10-14/extra-strings.json';
const previous=JSON.parse(await readFile(extraPath,'utf8').catch(()=>'{}'));
await writeFile(extraPath,JSON.stringify({...previous,...added},null,2)+'\n');
console.log(JSON.stringify({added:extra.size,total:index,strings:added},null,2));
