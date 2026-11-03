import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScriptForTests } from './load-ts-for-tests.mjs';
const { saveDeviceData, loadDeviceData, createBackup, STORAGE_KEY } = loadTypeScriptForTests(new URL('../deviceStorage.ts', import.meta.url));

function fixture(photoSize = 0) {
  return { people: Array.from({length:15},(_,index)=>({id:`test-${index}`,name:`אדם בדיקה ${index}`,city:'',role:'',status:'במסגרת',statusTags:[],color:'#000000',...(photoSize?{photoUri:'data:image/jpeg;base64,'+'A'.repeat(photoSize)}:{})})),guardPosts:[],guardTimeSlots:[],guardAssignments:[],rosterEntries:[],absenceReasons:[],baseOptions:[],tasks:[] };
}
function stores(limit = Infinity) {
  const local = new Map();let raw = null;
  const store = {getItem:key=>local.get(key)??null,setItem:(key,value)=>{if(value.length*2>limit)throw new DOMException('Full','QuotaExceededError');local.set(key,value);}};
  const database = {available:()=>true,read:async()=>raw,write:async value=>{raw=value;}};
  return {store,database,getDatabase:()=>raw};
}

test('photo collection larger than legacy quota saves and reloads from database',async()=>{
  const {store,database,getDatabase}=stores(5*1024*1024);
  const data=fixture(210000);
  assert.throws(()=>store.setItem(STORAGE_KEY,createBackup(data)),{name:'QuotaExceededError'});
  await saveDeviceData(data,()=>store,database);
  assert(getDatabase().length>3000000);
  assert.deepEqual((await loadDeviceData(()=>store,database)).data,data);
});

test('legacy data remains readable and migrates without deleting the old copy',async()=>{
  const {store,database}=stores();const data=fixture();
  store.setItem(STORAGE_KEY,createBackup(data));
  assert.deepEqual((await loadDeviceData(()=>store,database)).data,data);
  await saveDeviceData(data,()=>store,database);
  assert(store.getItem(STORAGE_KEY));
  assert.deepEqual((await loadDeviceData(()=>store,database)).data,data);
});

test('newer legacy fallback wins over an old database snapshot',async()=>{
  const {store,database}=stores();const old=fixture(),next=fixture();next.people[0].city='עודכן';
  await database.write(JSON.stringify({version:1,savedAt:'2000-01-01T00:00:00.000Z',data:old}));
  await saveDeviceData(next,()=>store,{...database,write:async()=>{throw new Error('Write unavailable');}});
  assert.deepEqual((await loadDeviceData(()=>store,database)).data,next);
});

test('an old app cannot replace the migrated database with a stale legacy collection',async()=>{
  const {store,database}=stores();const current=fixture();
  await saveDeviceData(current,()=>store,database);
  const stale=fixture();stale.people=stale.people.slice(0,2);
  store.setItem(STORAGE_KEY,JSON.stringify({version:1,savedAt:'2099-01-01T00:00:00.000Z',data:stale}));
  assert.deepEqual((await loadDeviceData(()=>store,database)).data,current);
});

test('serialized writes preserve the latest edit',async()=>{
  const {store,database}=stores();let first=true;
  const slow={...database,write:async raw=>{if(first){first=false;await new Promise(resolve=>setTimeout(resolve,30));}await database.write(raw);}};
  const before=fixture(),after=fixture();after.people[0].role='עודכן';
  await Promise.all([saveDeviceData(before,()=>store,slow),saveDeviceData(after,()=>store,slow)]);
  assert.deepEqual((await loadDeviceData(()=>store,database)).data,after);
});

test('failed writes preserve the previous stored collection',async()=>{
  const {store,database}=stores();const previous=fixture();await saveDeviceData(previous,()=>store,database);
  const broken={available:()=>true,read:database.read,write:async()=>{throw new DOMException('Full','QuotaExceededError');}};
  const blocked={getItem:store.getItem,setItem:()=>{throw new DOMException('Full','QuotaExceededError');}};
  await assert.rejects(saveDeviceData(fixture(210000),()=>blocked,broken),{name:'QuotaExceededError'});
  assert.deepEqual((await loadDeviceData(()=>store,database)).data,previous);
});

test('unreadable or malformed storage never becomes an empty writable collection',async()=>{
  const {store,database}=stores();store.setItem(STORAGE_KEY,'bad saved bytes');
  assert.equal((await loadDeviceData(()=>store,database)).kind,'error');
  assert.equal(store.getItem(STORAGE_KEY),'bad saved bytes');
  const clean=stores();const data=fixture();clean.store.setItem(STORAGE_KEY,createBackup(data));
  const result=await loadDeviceData(()=>clean.store,{available:()=>true,read:async()=>{throw new Error('Read failed');},write:clean.database.write});
  assert.equal(result.kind,'error');assert.deepEqual(result.data,data);
});
