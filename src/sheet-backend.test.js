import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

function database() {
  const tables=new Map([
    ['Expenses',[['id','date','description','total','paid','payer','source','reimbursed','remarks'],['exp-1','2026-10-01','Original',40,40,'Member','Collected Fund',0,'Keep this receipt']]],
    ['Members',[['id','name','annual','cash','sponsor'],['member-1','Member',50,50,0]]],
    ['Settings',[['Setting','Value'],['Opening fund',100]]],
  ]);
  const props=new Map(),cache=new Map();
  function sheet(name){
    const rows=tables.get(name);if(!rows)return null;
    function range(r,c,n=1,m=1){return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>rows[r+i-1]?.[c+j-1]??'')),setValue:value=>{while(rows.length<r)rows.push([]);rows[r-1][c-1]=value;},setValues:values=>values.forEach((row,i)=>row.forEach((v,j)=>range(r+i,c+j).setValue(v))),setNumberFormat:()=>{}};}
    return {getDataRange:()=>range(1,1,rows.length||1,Math.max(1,...rows.map(r=>r.length))),getRange:range,appendRow:row=>rows.push([...row]),deleteRow:r=>rows.splice(r-1,1),getLastRow:()=>rows.length};
  }
  const book={getSheetByName:sheet,insertSheet:name=>{tables.set(name,[]);return sheet(name);}};
  let locked=false;
  const context=vm.createContext({console,SpreadsheetApp:{openById:()=>book,flush:()=>{}},PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value)})},LockService:{getScriptLock:()=>({waitLock:()=>{locked=true;},hasLock:()=>locked,releaseLock:()=>{locked=false;}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,value)=>[...crypto.createHash('sha256').update(value).digest()],formatDate:date=>date.toISOString().slice(0,10)}});
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),context);
  const key='test-editor-key-not-a-live-credential';props.set('EDITOR_KEY_HASH',context.hash_(key));
  const read=()=>context.process_({action:'read',requestId:crypto.randomUUID()}).database;
  const write=(action,data,options={})=>context.process_({requestId:crypto.randomUUID(),editorKey:key,revision:read().revision,action,data,...options});
  return {read,write,tables,key};
}
test('unauthorized and stale writes leave the Sheet unchanged',()=>{
 const db=database(),snapshot=db.read();
 assert.equal(db.write('setOpeningFund',{amount:500},{editorKey:'wrong'}).ok,false);
 assert.equal(db.read().openingFund,100);
 assert.equal(db.write('setOpeningFund',{amount:200}).ok,true);
 const stale=db.write('setOpeningFund',{amount:300},{revision:snapshot.revision});
 assert.equal(stale.ok,false);assert.match(stale.error,/changed/);assert.equal(db.read().openingFund,200);
});
test('expense creation, editing and deletion persist, preserving unrelated columns',()=>{
 const db=database();
 const data={id:'exp-new',date:'2026-10-02',description:'Supplies',paid:20,total:30,payer:'Member',source:'Personal Advance',reimbursed:0};
 let response=db.write('upsertExpense',data);assert.equal(response.ok,true);assert.equal(response.database.expenses.length,2);
 response=db.write('upsertExpense',{...data,paid:30,total:30});assert.equal(response.ok,true);assert.equal(db.read().expenses.find(e=>e.id==='exp-new').paid,30);
 assert.equal(db.read().expenses.find(e=>e.id==='exp-1').remarks,'Keep this receipt');
 assert.equal(db.write('deleteExpense',{id:'exp-new'}).ok,true);assert.equal(db.read().expenses.length,1);
});
test('request replay is idempotent and changed payloads cannot reuse request IDs',()=>{
 const db=database(),requestId=crypto.randomUUID(),revision=db.read().revision;
 assert.equal(db.write('setOpeningFund',{amount:200},{requestId,revision}).ok,true);
 assert.equal(db.write('setOpeningFund',{amount:200},{requestId,revision}).ok,true);
 assert.equal(db.write('setOpeningFund',{amount:999},{requestId,revision}).ok,false);
 assert.equal(db.read().openingFund,200);
});
test('income, budgets and member contributions are stored in the canonical Sheet tables',()=>{
 const db=database();
 assert.equal(db.write('upsertTransaction',{id:'tx-1',date:'2026-10-02',name:'Donation',amount:100,type:'income',category:'Donations'}).ok,true);
 assert.equal(db.write('setBudget',{month:'2026-10',amount:500}).ok,true);
 assert.equal(db.write('upsertMember',{id:'member-1',name:'Member',annual:50,cash:75,sponsor:10}).ok,true);
 const snapshot=db.read();assert.equal(snapshot.additionalTransactions[0].amount,100);assert.equal(snapshot.budgets['2026-10'],500);assert.equal(snapshot.members[0].cash,75);
 assert.equal(db.write('deleteTransaction',{id:'tx-1'}).ok,true);assert.equal(db.read().additionalTransactions.length,0);
});
test('invalid payments, unknown payers, impossible dates and formula input are rejected',()=>{
 const db=database(),data={id:'exp-2',date:'2026-10-02',description:'Valid',paid:20,total:20,payer:'Member',source:'Personal Advance'};
 for(const changes of [{paid:30},{reimbursed:30},{payer:'Unknown'},{date:'2026-02-30'},{description:'=IMPORTXML("bad")'}])assert.equal(db.write('upsertExpense',{...data,...changes}).ok,false);
 assert.equal(db.read().expenses.length,1);
});
