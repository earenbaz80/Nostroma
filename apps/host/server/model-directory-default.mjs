import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';
import { utf8Script } from './powershell-utf8.mjs';

/** Resolve the user's Documents folder without evaluating shell configuration. */
export function defaultModelDirectory({platform=process.platform,home=homedir(),env=process.env,read=readFileSync,windowsDocuments=()=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',utf8Script("[Environment]::GetFolderPath('MyDocuments')")],{encoding:'utf8',timeout:5000,windowsHide:true}).trim()}={}) {
 const path=platform==='win32'?win32:posix;
 const modelsDir=env.NOSTROMA_MODELS_DIR??(env.NOSTROMA_MODELS_DIR ?? env.STRATA_MODELS_DIR);
 if(modelsDir)return path.resolve(modelsDir);
 let documents=env.NOSTROMA_DOCUMENTS_DIR??(env.NOSTROMA_DOCUMENTS_DIR ?? env.STRATA_DOCUMENTS_DIR);
 if(!documents&&platform==='win32'){try{documents=windowsDocuments();}catch{} }
 if(!documents&&platform==='linux'){
  let value=env.XDG_DOCUMENTS_DIR;
  if(!value){try{value=read(path.join(env.XDG_CONFIG_HOME||path.join(home,'.config'),'user-dirs.dirs'),'utf8').match(/^\s*XDG_DOCUMENTS_DIR="([^"\n]+)"/m)?.[1];}catch{} }
  if(value){const expanded=value.replace(/\$\{HOME\}|\$HOME(?=\/|$)/g,home);if(!expanded.includes('$')&&path.isAbsolute(expanded))documents=expanded;}
 }
 if(!documents||!path.isAbsolute(documents))documents=path.join(home,'Documents');
 // The folder is Nostroma's now. A library from the Strata days moves once, so no model has to be downloaded again; if it
 // cannot be moved it keeps being read where it is.
 const target=path.join(documents,'Nostroma','Models'),previous=path.join(documents,'Strata','Models');
 try{ if(!existsSync(target)&&existsSync(previous)){mkdirSync(path.dirname(target),{recursive:true});renameSync(previous,target);} }catch{ return previous; }
 return target;
}
