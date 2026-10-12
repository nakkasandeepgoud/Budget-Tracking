import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize,validTransaction} from './model.js';
test('monthly totals separate income and expenses and exclude other months',()=>{
 const result=summarize([{date:'2026-10-01',type:'income',amount:1000},{date:'2026-10-02',type:'expense',amount:125},{date:'2026-09-01',type:'expense',amount:500}],'2026-10');
 assert.equal(result.income,1000); assert.equal(result.expenses,125); assert.equal(result.balance,875); assert.equal(result.selected.length,2);
});
test('rejects invalid transaction amounts and dates',()=>{
 const t={id:'1',name:'Lunch',amount:10,type:'expense',category:'Food & dining',date:'2026-10-01'};
 assert.equal(validTransaction(t),true);
 for (const amount of [0,-1,Infinity,NaN,'10']) assert.equal(validTransaction({...t,amount}),false);
 assert.equal(validTransaction({...t,date:'invalid'}),false);
});
