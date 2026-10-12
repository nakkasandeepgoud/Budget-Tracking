import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importDatabase,databaseSummary} from './import.js';

const data={format:'budget-tracking-database-v1',openingFund:100,reportingMonth:'2026-10',members:[{id:'m1',name:'Member',annual:50,cash:50,sponsor:0}],expenses:[{id:'e1',date:'2026-10-10',description:'Paid expense',total:40,paid:40,payer:'Member',source:'Collected Fund'},{id:'e2',date:'2026-10-11',description:'Unpaid expense',total:80,paid:0,payer:'',source:''},{id:'e3',date:'2026-10-12',description:'Advance',total:20,paid:20,payer:'Member',source:'Personal Advance'}]};
test('import preserves unpaid records without inventing payments and labels undated income',()=>{
 const {transactions,database}=importDatabase(data);
 assert.equal(database.expenses.length,3);
 assert.equal(transactions.filter(t=>t.type==='expense').length,2);
 assert.equal(transactions.find(t=>t.id==='database-opening').date,'2026-10-01');
 assert.match(transactions.find(t=>t.id==='database-m1').name,/assumed/);
 assert.deepEqual(databaseSummary(database),{total:140,paid:60,due:80,collections:50,advances:20,fundBalance:110});
});
test('invalid amounts and duplicate records are rejected before importing',()=>{
 assert.throws(()=>importDatabase({...data,openingFund:-1}));
 assert.throws(()=>importDatabase({...data,expenses:[...data.expenses,data.expenses[0]]}));
 assert.throws(()=>importDatabase({...data,expenses:[{...data.expenses[0],paid:100}]}));
});
