import {validTransaction} from './model.js';

const amount = value => Number.isFinite(value) && value >= 0;
export function importDatabase(data) {
  if (!data || data.format !== 'budget-tracking-database-v1' || !Array.isArray(data.expenses) || !Array.isArray(data.members) || !amount(data.openingFund) || !/^\d{4}-\d{2}$/.test(data.reportingMonth)) throw new Error('Choose a valid application database JSON file.');
  const expenseIds = new Set(), memberIds = new Set();
  for (const e of data.expenses) {
    if (!e || typeof e.id !== 'string' || expenseIds.has(e.id) || typeof e.description !== 'string' || !e.description.trim() || !amount(e.total) || !amount(e.paid) || e.paid > e.total || (e.reimbursed!==undefined&&(!amount(e.reimbursed)||e.reimbursed>e.paid)) || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || Number.isNaN(Date.parse(e.date)) || typeof e.payer !== 'string' || !['Collected Fund','Personal Advance','Sponsor',''].includes(e.source)) throw new Error('The file contains an invalid expense.');
    expenseIds.add(e.id);
  }
  for (const m of data.members) {
    if (!m || typeof m.id !== 'string' || memberIds.has(m.id) || typeof m.name !== 'string' || !m.name.trim() || !amount(m.annual) || !amount(m.cash) || !amount(m.sponsor)) throw new Error('The file contains an invalid member.');
    memberIds.add(m.id);
  }
  const date = data.reportingMonth + '-01';
  const transactions = data.expenses.filter(e => e.paid > 0).map(e => ({id:'database-'+e.id, date:e.date, name:e.description, amount:e.paid, type:'expense', category:typeof e.category==='string'?e.category:'Event expenses'}));
  if (data.openingFund > 0) transactions.push({id:'database-opening',date,name:'Opening fund (reporting date assumed)',amount:data.openingFund,type:'income',category:'Opening fund'});
  transactions.push(...data.members.filter(m=>m.cash>0).map(m=>({id:'database-'+m.id,date,name:m.name+' — contribution (reporting date assumed)',amount:m.cash,type:'income',category:'Member contributions'})));
  transactions.push(...data.members.filter(m=>m.sponsor>0).map(m=>({id:'database-sponsor-'+m.id,date,name:m.name+' — sponsorship (reporting date assumed)',amount:m.sponsor,type:'income',category:'Sponsor contributions'})));
  if(data.additionalTransactions!==undefined){
    if(!Array.isArray(data.additionalTransactions)||!data.additionalTransactions.every(validTransaction)||new Set(data.additionalTransactions.map(t=>t.id)).size!==data.additionalTransactions.length)throw new Error('Invalid additional transactions.');
    transactions.push(...data.additionalTransactions.map(t=>({...t,id:'sheet-extra-'+t.id})));
  }
  if(data.budgets!==undefined&&(!data.budgets||typeof data.budgets!=='object'||Array.isArray(data.budgets)||Object.entries(data.budgets).some(([k,v])=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)||!amount(v))))throw new Error('Invalid shared budgets.');
  if (!transactions.every(validTransaction)) throw new Error('The file contains invalid transaction data.');
  return {transactions, database: JSON.parse(JSON.stringify(data))};
}

export function databaseSummary(data) {
  const total = data.expenses.reduce((s,e)=>s+e.total,0);
  const paid = data.expenses.reduce((s,e)=>s+e.paid,0);
  const collections = data.members.reduce((s,m)=>s+m.cash,0);
  const advances = data.advanceRule==='all-payers'
    ? data.members.reduce((s,m)=>s+Math.max(0,data.expenses.filter(e=>e.payer===m.name).reduce((sum,e)=>sum+e.paid-(e.reimbursed||0),0)),0)
    : data.expenses.filter(e=>e.source==='Personal Advance').reduce((s,e)=>s+e.paid-(e.reimbursed||0),0);
  const fundSpent = data.expenses.filter(e=>e.source==='Collected Fund').reduce((s,e)=>s+e.paid,0);
  const sponsor=data.members.reduce((s,m)=>s+m.sponsor,0),reimbursed=data.expenses.reduce((s,e)=>s+(e.reimbursed||0),0);
  const extraNet=(data.additionalTransactions||[]).reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0);
  return {total,paid,due:total-paid,collections,advances,fundBalance:data.openingFund+collections+sponsor+extraNet-fundSpent-reimbursed};
}
