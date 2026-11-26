import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const bundle=await build({stdin:{contents:"export {getState,setLanguage,setFontFamily,setWallpaper,resetAppearance} from './src/lib/store'; export {tr,currentLanguage,translationsReady,loadCatalog} from './src/lib/i18n';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs'});
function open(saved){
 const data=new Map(Object.entries(saved)),css=new Map(),root={dataset:{},style:{setProperty:(key,value)=>css.set(key,value),removeProperty:key=>css.delete(key)}};
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 const mod={exports:{}};
 new Function('require','module','exports','localStorage','sessionStorage','matchMedia','document',bundle.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports,storage,storage,()=>({matches:false,addEventListener(){}}),{documentElement:root,querySelector:()=>null});
 return{...mod.exports,data,css,root};
}
test('saved language applies on the first render; language and installed font persist together',async()=>{
 const first=open({'nostroma.prefs.v2':JSON.stringify({language:'ko',fontFamily:''})});
 await first.translationsReady();   // main.tsx waits for this before it draws the first screen
 assert.equal(first.currentLanguage(),'ko');assert.notEqual(first.tr('Settings'),'Settings');
 await first.loadCatalog('pt');first.setLanguage('pt');first.setFontFamily('Arial');
 assert.equal(first.root.lang,'pt');assert.match(first.css.get('--st-font'),/^"Arial",system-ui/);
 const second=open(Object.fromEntries(first.data));assert.equal(second.currentLanguage(),'pt');assert.equal(second.getState().fontFamily,'Arial');
 second.setFontFamily('');assert.equal(second.css.has('--st-font'),false);assert.equal(second.getState().language,'pt');
});
test('invalid saved language falls back to English and font names reject control characters',()=>{
 const app=open({'nostroma.prefs.v2':JSON.stringify({language:'unknown',fontFamily:'Arial\u0000'})});assert.equal(app.currentLanguage(),'en');assert.equal(app.getState().fontFamily,'Arial');
});
test('the chosen background picture persists and paints the page; a path never does',()=>{
 const app=open({'nostroma.prefs.v2':JSON.stringify({wallpaper:'fondo 1.png'})});
 assert.equal(app.getState().wallpaper,'fondo 1.png');
 app.setWallpaper('otro.webp');
 assert.equal(app.getState().wallpaper,'otro.webp');assert.equal(app.root.dataset.wallpaper,'image');
 assert.match(app.css.get('--st-wallpaper-image'),/\/api\/appearance\/wallpapers\/otro.webp/);
 assert.equal(JSON.parse(app.data.get('nostroma.prefs.v2')).wallpaper,'otro.webp');
 app.setWallpaper('../bad.png');assert.equal(app.getState().wallpaper,'default');assert.equal('wallpaper' in app.root.dataset,false);
 app.setWallpaper('otro.webp');app.resetAppearance();assert.equal(app.getState().wallpaper,'default');assert.equal('wallpaper' in app.root.dataset,false);
});
