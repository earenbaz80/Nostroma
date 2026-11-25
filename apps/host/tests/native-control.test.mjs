import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {nativeFixture,finishJob} from './helpers/native-fixture.mjs';
test('native instances isolate devices, ports, IDs and private keys; default loading switches one model',async()=>{
 const f=nativeFixture();try{
  await f.control.refresh(true);const load=async args=>{const job=f.control.operation('load',args);const done=await finishJob(f.control,job.id);assert.equal(done.state,'done',done.error);return f.control.resolveInstance(done.result.instanceId);};
  const a=await load({model:'iq2_xs',gpus:[0]}),b=await load({model:'iq3_s',gpus:[1],multiple:true});assert.equal(f.control.state().instances.length,2);assert.notEqual(a.port,b.port);assert.notEqual(a.key,b.key);assert.deepEqual(b.gpus,[1]);assert.throws(()=>f.control.resolveInstance('chat'),/more than one/);assert.throws(()=>f.control.resolveInstance(),/Choose/);
  assert.equal(JSON.stringify(f.control.state()).includes(a.key),false);
  const failed=await finishJob(f.control,f.control.operation('load',{model:'iq3_s',gpus:[99]}).id);assert.equal(failed.state,'error');assert.equal(f.control.state().instances.length,2);
  f.requests.push({instanceId:a.id,state:'generating'});await assert.rejects(f.control.unload(a.id),/Finish/);f.requests.length=0;
  await f.control.unload(b.id);const c=await load({model:'iq2_xs',gpus:[1],multiple:true});assert.equal(c.apiModelId,'iq2_xs--2');const same=await load({model:'iq2_xs',gpus:[1],multiple:true});assert.equal(same.id,c.id);const beforeCount=f.control.state().instances.length;const reloaded=await load({model:'iq2_xs',gpus:[1],multiple:true,values:{parallel:2}});assert.equal(reloaded.id,c.id);assert.equal(reloaded.apiModelId,c.apiModelId);assert.equal(f.control.state().instances.length,beforeCount);assert.deepEqual(f.control.resolveInstance(a.apiModelId).gpus,[0]);
  await load({model:'iq3_s',gpus:[0]});assert.equal(f.control.state().instances.length,1);assert.equal(readdirSync(join(f.directory,'native-instances')).length,1);
 }finally{await f.cleanup();}
});
test('native save preserves unknown fields, credentials and a backup; null restores native defaults',async()=>{
 const f=nativeFixture();try{await f.control.refresh();const original=f.control.settings('iq2_xs');assert.equal(original.values.env.NOSTROMA_TOKEN,'••••••••');f.control.save('iq2_xs',{values:{...original.values,parallel:2,reasoning_budget_tokens:null},mcp:{files:{command:'node',args:['file-server.mjs'],env:{TOKEN:'secret'}}}});
 const saved=JSON.parse(readFileSync(join(f.repo,'nostroma-iq2_xs.json')));assert.deepEqual(saved.unknown_native_key,{preserve:true});assert.equal(saved.env.PATH,'/native/bin');assert.equal(saved.env.NOSTROMA_TOKEN,'private');assert.equal(saved.parallel,2);assert.equal('reasoning_budget_tokens' in saved,false);assert.ok(readFileSync(join(f.repo,'nostroma-iq2_xs.json.bak')));
 assert.equal(f.control.settings('iq2_xs').mcp.files.env.TOKEN,'••••••••');
 }finally{await f.cleanup();}
});
test('a model that reads pictures cannot save lazy loading, and says why; a text model still can (#P0-1)',async()=>{
 const f=nativeFixture();try{await f.control.refresh(true);
  const pictures=f.control.settings('iq2_xs');                                  // the fixture's config carries a vision section
  assert.match(pictures.refused?.lazy_load??'',/^Lazy loading does not work with picture reading\./,'the settings response explains it');
  assert.deepEqual(Object.keys(pictures.refused),['lazy_load'],'nothing else is refused');
  assert.throws(()=>f.control.save('iq2_xs',{values:{...pictures.values,lazy_load:true}}),/Lazy loading does not work with picture reading\./);
  assert.equal(f.control.settings('iq2_xs').values.lazy_load??null,null,'the refusal wrote nothing');
  assert.throws(()=>f.control.save('iq2_xs',{values:{...pictures.values,lazy_load:'yes'}}),/choose on or off/,'the type is checked first');
  const off=f.control.save('iq2_xs',{values:{...pictures.values,lazy_load:false}});
  assert.equal(off.values.lazy_load,false,'turning it off is fine');
  assert.ok(off.refused.lazy_load,'and the row still says why it cannot be turned on');
  const path=join(f.repo,'nostroma-iq3_s.json'),config=JSON.parse(readFileSync(path,'utf8'));
  delete config.vision;writeFileSync(path,JSON.stringify(config,null,2));await f.control.refresh(true);
  const text=f.control.settings('iq3_s');
  assert.deepEqual(text.refused,{},'a text model has no refusal');
  assert.equal(f.control.save('iq3_s',{values:{...text.values,lazy_load:true}}).values.lazy_load,true,'a text model keeps the choice');
 }finally{await f.cleanup();}
});
test('a setting this PC cannot use is disabled with its reason and never saved (#P0-2)',async()=>{
 const f=nativeFixture();try{await f.control.refresh(true);
  f.setHardware({ram_gb:64,gpus:[{index:0,name:'NVIDIA RTX 4090',vendor:'nvidia',vram_gb:24}]});await f.control.refresh(true);
  const one=f.control.settings('iq2_xs');
  assert.deepEqual(Object.keys(one.notApplicable).sort(),['gpu_order','layer_split','split_skip_if_fits'],'one card: the three split rows, and the elastic cache still applies');
  assert.match(one.notApplicable.layer_split,/^This needs two or more graphics cards\./,'the row says why in plain words');
  assert.equal(one.notApplicable.vision_tokens,undefined,'this model reads pictures, so the image limits work');
  assert.throws(()=>f.control.save('iq2_xs',{values:{...one.values,layer_split:'16,32'}}),/two or more graphics cards/,'a change that does nothing is refused');
  assert.equal(f.control.settings('iq2_xs').values.layer_split??null,null,'and wrote nothing');
  const same=f.control.save('iq2_xs',{values:one.values});
  assert.deepEqual(same.notApplicable,one.notApplicable,'saving the rest of the form still works');
  f.setHardware({ram_gb:64,gpus:[{index:0,name:'AMD Radeon RX 7900 XTX',vendor:'amd',vram_gb:24}]});await f.control.refresh(true);
  const radeon=f.control.settings('iq2_xs');
  assert.match(radeon.notApplicable.vram_elastic??'',/^This works on one NVIDIA graphics card/,'the elastic cache is NVIDIA\'s');
  assert.throws(()=>f.control.save('iq2_xs',{values:{...radeon.values,vram_elastic:true}}),/one NVIDIA graphics card/);
  f.setHardware({ram_gb:64,gpus:[{index:0,name:'NVIDIA RTX 4090',vendor:'nvidia',vram_gb:24},{index:1,name:'NVIDIA RTX 4090',vendor:'nvidia',vram_gb:24}]});await f.control.refresh(true);
  const two=f.control.settings('iq2_xs');
  assert.equal(two.notApplicable.layer_split,undefined,'two cards can split');
  assert.deepEqual(Object.keys(two.notApplicable),['vram_elastic'],'and the elastic cache is the one left out');
  assert.throws(()=>f.control.save('iq2_xs',{values:{...two.values,batchMtp:true,parallel:1}}),/draft layer/,'MTP per request with one slot is refused too');
 }finally{await f.cleanup();}
});
test('benchmarks retain reported rates and cancellation aborts measurement',async()=>{
 const f=nativeFixture();try{await f.control.refresh();const loaded=await finishJob(f.control,f.control.operation('load',{model:'iq2_xs'}).id);assert.equal(loaded.state,'done');const measured=await finishJob(f.control,f.control.operation('benchmark',{instanceId:loaded.result.instanceId}).id);assert.equal(measured.result.outputTps,41);assert.equal(measured.result.promptTps,1000);assert.equal(f.control.benchmarkReport().source,'engine');
 f.setBenchmarkWait(true);const job=f.control.operation('benchmark',{instanceId:loaded.result.instanceId});await new Promise(r=>setTimeout(r,10));await f.control.cancel(job.id);assert.equal(f.control.state().jobs.find(j=>j.id===job.id).state,'cancelled');assert.equal(f.control.benchmarkReport().outputTps,41);
 }finally{await f.cleanup();}
});
test('the app update is refused before git runs; calibration targets the chosen installed configuration',async()=>{
 const f=nativeFixture();try{await f.control.refresh();const asked=f.calls.length;assert.throws(()=>f.control.operation('update-nostroma'),/App updates are off/);assert.deepEqual(f.calls.slice(asked),[],'the refused update ran nothing (no git status, no pull)');
 const calibrated=await finishJob(f.control,f.control.operation('calibrate',{model:'iq3_s'}).id);assert.equal(calibrated.state,'done',calibrated.error);assert.ok(f.calls.find(c=>c.args[0]==='-c'&&c.args[2].endsWith('nostroma-iq3_s.json')));
 f.setExternal([{port:8080,model:'other'}]);await f.control.refresh(true);const load=await finishJob(f.control,f.control.operation('load',{model:'iq2_xs'}).id);assert.equal(load.state,'error');assert.match(load.error,/outside this UI/);
 }finally{await f.cleanup();}
});

test('cancelling a native load before dispatch preserves the running instance',async()=>{const f=nativeFixture();try{await f.control.refresh();const first=await finishJob(f.control,f.control.operation('load',{model:'iq2_xs',gpus:[0]}).id);const job=f.control.operation('load',{model:'iq3_s',gpus:[1]});await f.control.cancel(job.id);await new Promise(r=>setTimeout(r,20));assert.equal(f.control.state().instances.length,1);assert.equal(f.control.state().instances[0].id,first.result.instanceId);assert.equal(f.control.state().jobs.find(j=>j.id===job.id).state,'cancelled');}finally{await f.cleanup();}});

test('retuning or repairing an installed native model reuses its original data folder',async()=>{const f=nativeFixture();try{await f.control.refresh();await f.control.plan({family:'qwen',model:'IQ2_XS',context:131072});const call=f.rpcCalls.find(c=>c.name==='nostroma_install');assert.equal(call.arguments.data_dir,f.installed.data_folder);assert.equal(call.arguments.confirm,false);}finally{await f.cleanup();}});

test('a model the person pointed at their own GGUF folder keeps that folder for the next load: setup is not asked to download it again (#3199)',async()=>{const f=nativeFixture();try{
 const own=join(f.directory,'my-ggufs');mkdirSync(own,{recursive:true});const shard=join(own,'Qwen3.8-Flash-Next-IQ2_XS-00001-of-00002.gguf');writeFileSync(shard,'x');
 const path=join(f.repo,'nostroma-iq2_xs.json'),config=JSON.parse(readFileSync(path));config.args=['--native',shard,'--max-context','32768'];writeFileSync(path,JSON.stringify(config));
 await f.control.refresh(true);await f.control.plan({family:'qwen',model:'IQ2_XS',context:131072});
 const call=f.rpcCalls.filter(c=>c.name==='nostroma_install').pop();assert.equal(call.arguments.gguf_dir,own);assert.equal(call.arguments.data_dir,undefined,'the person\'s folder is not the data folder');
 await f.control.plan({family:'qwen',model:'IQ3_S',context:131072});const other=f.rpcCalls.filter(c=>c.name==='nostroma_install').pop();assert.equal(other.arguments.gguf_dir,undefined,'a model Nostroma downloaded itself keeps its normal folders');
}finally{await f.cleanup();}});
