import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNativeSettings,validateMcpServers,publicMcpServers,publicNativeEnv,restoreNativeEnv,fieldRefusal,fieldRefusals,LAZY_LOAD_VISION_REFUSAL,fieldApplicability,fieldApplicabilityMap,NOT_APPLICABLE} from '../server/native-settings.mjs';
import {validateChatImages} from '../server/chat-images.mjs';
test('native settings reject invalid ranges and unmanaged network arguments',()=>{
 assert.deepEqual(validateNativeSettings({parallel:2,layer_split:'16,32',reasoning_budget_tokens:null,sampling:{temperature:.7}}),{parallel:2,layer_split:'16,32',reasoning_budget_tokens:null,sampling:{temperature:.7}});
 for(const value of [{parallel:0},{parallel:1.2},{layer_split:'32,16'},{layer_split:'48'},{exe:'/tmp/program'},{args:['--host','0.0.0.0']},{env:{HOME:'/tmp'}},{sampling:{top_p:2}},{anthropic_thinking:'always'}])assert.throws(()=>validateNativeSettings(value));
});
test('a field the model rules out comes with its reason: lazy loading with picture reading (#P0-1)',()=>{
 assert.equal(fieldRefusal('lazy_load',{vision:false}),null,'a text model keeps the choice');
 assert.equal(fieldRefusal('lazy_load',{vision:true}),LAZY_LOAD_VISION_REFUSAL,'a model that reads pictures is told why');
 assert.match(LAZY_LOAD_VISION_REFUSAL,/^Lazy loading does not work with picture reading\./,'a plain sentence, not a code');
 assert.equal(fieldRefusal('parallel',{vision:true}),null,'nothing else is taken away');
 assert.deepEqual(fieldRefusals({}),{},'no vision section, no refusals');
 assert.deepEqual(fieldRefusals({vision:{gpu:0}}),{lazy_load:LAZY_LOAD_VISION_REFUSAL},'the picture reader is on');
});
test('a setting this PC or this model has no use for says why, and nothing else is marked (#P0-2)',()=>{
 const nvidia=[{name:'NVIDIA RTX 4090',vendor:'nvidia',vram_gb:24}],nvidia2=[{name:'NVIDIA RTX 4090',vendor:'nvidia',vram_gb:24},{name:'NVIDIA RTX 3090',vendor:'nvidia',vram_gb:24}];
 const amd=[{name:'AMD Radeon RX 7900 XTX',vendor:'amd',vram_gb:24}],igpu=[{name:'AMD Radeon 780M',integrated:true,vram_gb:8}],unity=[{name:'NVIDIA RTX 5060 Ti',vendor:'nvidia',vram_gb:16,uma:true}];
 // the elastic expert cache is NVIDIA's and needs one card
 assert.equal(fieldApplicability('vram_elastic',{gpus:nvidia}),null,'one NVIDIA card uses it');
 for(const gpus of [amd,igpu,nvidia2,unity,[]])assert.equal(fieldApplicability('vram_elastic',{gpus}),NOT_APPLICABLE.oneNvidia,'anything else is told why');
 // the split choices need two or more cards
 for(const id of ['layer_split','gpu_order','split_skip_if_fits']){
  assert.equal(fieldApplicability(id,{gpus:nvidia}),NOT_APPLICABLE.multiGpu,'one card has nothing to split');
  assert.equal(fieldApplicability(id,{gpus:nvidia2}),null,'two cards do');
 }
 // the image token limits need a picture reader, MTP per request needs the draft layer and more than one slot
 assert.equal(fieldApplicability('vision_tokens',{vision:false}),NOT_APPLICABLE.vision);assert.equal(fieldApplicability('vision_min_tokens',{vision:false}),NOT_APPLICABLE.vision);
 assert.equal(fieldApplicability('vision_tokens',{vision:true}),null);
 assert.equal(fieldApplicability('batchMtp',{}),null,'the app\'s four slots and the draft layer are the default');
 for(const facts of [{parallel:1},{mtp:false},{drafting:'off'},{drafting:'dflash2'}])assert.equal(fieldApplicability('batchMtp',facts),NOT_APPLICABLE.draftLayer,JSON.stringify(facts));
 assert.equal(fieldApplicability('batchMtp',{parallel:2,drafting:'mtp'}),null,'two slots with the MTP do use it');
 // a matrix of six profiles: only the four rules above ever mark a row, never a field that works
 const profiles={nvidia1:{gpus:nvidia,config:{}},nvidia1Vision:{gpus:nvidia,config:{vision:{gpu:0}}},amd1:{gpus:amd,config:{}},multi:{gpus:nvidia2,config:{}},igpu:{gpus:igpu,config:{}},textOneSlot:{gpus:nvidia,config:{parallel:1}}};
 const ruled=['vram_elastic','layer_split','gpu_order','split_skip_if_fits','vision_tokens','vision_min_tokens','batchMtp'];
 for(const [name,{gpus,config}] of Object.entries(profiles)){
  const map=fieldApplicabilityMap(config,{gpus});
  for(const key of Object.keys(map))assert.ok(ruled.includes(key),`${name}: ${key} is marked for a reason the audit knows`);
  for(const key of ruled)assert.equal(typeof map[key]==='string'||map[key]===undefined,true,`${name}: ${key}`);
 }
 assert.deepEqual(fieldApplicabilityMap({},{gpus:nvidia}),{'layer_split':NOT_APPLICABLE.multiGpu,'gpu_order':NOT_APPLICABLE.multiGpu,'split_skip_if_fits':NOT_APPLICABLE.multiGpu,'vision_tokens':NOT_APPLICABLE.vision,'vision_min_tokens':NOT_APPLICABLE.vision},'a text model on one NVIDIA card: the split rows and the image limits, nothing more');
 assert.equal(fieldApplicability('parallel',{gpus:amd,vision:false}),null,'the other fields are left alone');
});
test('MCP secrets round trip masked values and reject malformed transport settings',()=>{
 const previous={files:{command:'node',args:['server.mjs'],env:{API_KEY:'private-key'},disabled:false},remote:{url:'https://example.test/mcp',headers:{Authorization:'Bearer private'}}};
 const masked=publicMcpServers(previous);assert.equal(masked.files.env.API_KEY,'••••••••');assert.equal(JSON.stringify(masked).includes('private'),false);assert.deepEqual(validateMcpServers(masked,previous),previous);
 for(const value of [{x:{command:'node',url:'https://example.test'}},{x:{url:'file:///tmp'}},{x:{command:'node',cwd:123}},{x:{url:'https://example.test',headers:{Authorization:'secret\r\nX: bad'}}},{x:{command:'node',env:{KEY:'••••••••'}}}])assert.throws(()=>validateMcpServers(value));
});
test('environment masks preserve credentials and unrelated existing configuration',()=>{
 const previous={PATH:'/native/bin',NOSTROMA_API_KEY:'private',NOSTROMA_PREFILL:'2'};
 assert.deepEqual(publicNativeEnv(previous),{NOSTROMA_API_KEY:'••••••••',NOSTROMA_PREFILL:'2'});
 assert.deepEqual(restoreNativeEnv({NOSTROMA_API_KEY:'••••••••',NOSTROMA_PREFILL:'3'},previous),{...previous,NOSTROMA_PREFILL:'3'});
 assert.throws(()=>restoreNativeEnv({NOSTROMA_TOKEN:'••••••••'}));
});
test('chat accepts bounded attached images and rejects remote or oversized image payloads',()=>{
 const photo={name:'photo.png',url:'data:image/png;base64,aGVsbG8='};assert.deepEqual(validateChatImages([photo]),[photo]);
 assert.throws(()=>validateChatImages([{url:'https://private.test/image.png'}]));assert.throws(()=>validateChatImages(Array(5).fill(photo)));assert.throws(()=>validateChatImages([{url:'data:image/png;base64,'+Buffer.alloc(6*1024*1024+1).toString('base64')}]));
});
