import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseExcel} from './excel.js';
import {databaseSummary} from './import.js';

async function fixture({paid=40,includeMembers=true}={}) {
  const workbook=new ExcelJS.Workbook();
  const expenses=workbook.addWorksheet('Expenses');
  expenses.addRow(['Event expense register']);
  expenses.addRow(['Date','Description','Total Amount','Amount Paid','Paid By','Funding Source','Reimbursed Amount','Due Date','Remarks']);
  expenses.addRow([new Date('2026-10-10T00:00:00Z'),'Paid expense',40,paid,'Member','Collected Fund',0,null,'Receipt kept']);
  expenses.addRow([new Date('2026-10-11T00:00:00Z'),'Unpaid expense',80,0,'','',0,new Date('2026-10-20T00:00:00Z'),'']);
  expenses.addRow([null,'Total',{formula:'SUM(C3:C4)',result:120},40]);
  if(includeMembers){
    const members=workbook.addWorksheet('Member Funds');
    members.addRow(['Opening Fund (Last Year)',100]);
    members.addRow(['Member','Annual Due','Cash Given','Sponsor Amount']);
    members.addRow(['Member',50,50,10]);
    members.addRow(['Total',50,50,10]);
  }
  return workbook.xlsx.writeBuffer();
}
test('Excel upload reads dates, skips total rows, preserves details and reconciles workbook advances',async()=>{
  const result=await parseExcel(await fixture());
  assert.equal(result.database.expenses.length,2);
  assert.equal(result.database.members.length,1);
  assert.equal(result.database.expenses[0].date,'2026-10-10');
  assert.equal(result.database.expenses[0].remarks,'Receipt kept');
  assert.equal(result.database.expenses[1].dueDate,'2026-10-20');
  assert.equal(result.transactions.length,4);
  assert.deepEqual(databaseSummary(result.database),{total:120,paid:40,due:80,collections:50,advances:40,fundBalance:120});
});
test('Excel import rejects payments greater than commitments',async()=>{
  await assert.rejects(()=>fixture({paid:100}).then(parseExcel),/invalid expense/);
});
test('Excel import reports missing worksheets',async()=>{
  await assert.rejects(()=>fixture({includeMembers:false}).then(parseExcel),/Expenses and Member Funds/);
});
test('Google database tabs use source IDs and the Personal Advance-only rule',async()=>{
 const workbook=new ExcelJS.Workbook();
 workbook.addWorksheet('Sheet1');
 const expenses=workbook.addWorksheet('Expenses');
 expenses.addRow(['id','date','description','total','paid','payer','remarks','source','sponsor','reimbursed','due']);
 expenses.addRow(['exp-1','2026-10-01','Fund payment',40,40,'Member','','Collected Fund','','',0]);
 expenses.addRow(['exp-2','2026-10-02','Personal payment',20,20,'Member','','Personal Advance','',0,0]);
 expenses.addRow(['exp-3','2026-10-03','Unpaid',80,0,'','','','','',0]);
 const members=workbook.addWorksheet('Members');
 members.addRow(['id','name','annual','cash','sponsor']);
 members.addRow(['member-1','Member',50,50,0]);
 const settings=workbook.addWorksheet('Settings');
 settings.addRow(['Setting','Value']);settings.addRow(['Opening fund',100]);
 const result=await parseExcel(await workbook.xlsx.writeBuffer());
 assert.equal(result.database.advanceRule,'personal-advance-only');
 assert.equal(result.database.expenses[0].reimbursed,undefined);
 assert.equal(result.transactions.find(t=>t.id==='database-exp-1').amount,40);
 assert.deepEqual(databaseSummary(result.database),{total:140,paid:60,due:80,collections:50,advances:20,fundBalance:110});
 const extra=workbook.addWorksheet('Transactions');
 extra.addRow(['id','date','name','amount','type','category']);extra.addRow(['tx-1','2026-10-12','Donation',100,'income','Donations']);
 const budgets=workbook.addWorksheet('Budgets');budgets.addRow(['month','amount']);budgets.addRow(['2026-10',500]);
 const updated=await parseExcel(await workbook.xlsx.writeBuffer());
 assert.equal(updated.database.budgets['2026-10'],500);
 assert.equal(updated.transactions.find(t=>t.id==='sheet-extra-tx-1').amount,100);
 assert.equal(databaseSummary(updated.database).fundBalance,210);
});
