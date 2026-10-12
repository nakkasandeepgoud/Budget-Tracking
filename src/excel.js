import ExcelJS from 'exceljs';
import {importDatabase} from './import.js';

const cellValue = cell => {
  const value=cell.value;
  if(value && typeof value==='object' && !(value instanceof Date)) {
    if ('formula' in value || 'sharedFormula' in value) return value.result;
    if ('richText' in value) return value.richText.map(t=>t.text).join('');
  }
  return value;
};
const text = cell => String(cellValue(cell) ?? '').trim();
const number = cell => {
  const value=cellValue(cell);
  if(value===null || value===undefined || value==='')return 0;
  if(typeof value!=='number' || !Number.isFinite(value))throw new Error('A money cell is not a number. Recalculate and save the workbook in Excel before importing.');
  return value;
};
const date = cell => {
  const value=cellValue(cell);
  if(value===null||value===undefined||value==='')return '';
  if(value instanceof Date && !Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
  if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  throw new Error('Expense dates must be Excel dates or YYYY-MM-DD values.');
};
function header(sheet,labels) {
  for(let i=1;i<=Math.min(sheet.rowCount,30);i++) {
    const row=sheet.getRow(i),columns={};
    row.eachCell((cell,j)=>{columns[text(cell)]=j;});
    if(labels.every(label=>columns[label]))return {index:i,columns};
  }
  throw new Error(`Missing expected columns in the ${sheet.name} sheet. First row: ${sheet.getRow(1).values.filter(Boolean).map(String).join(', ')}`);
}
function parseDatabaseWorkbook(workbook) {
  const expensesSheet=workbook.getWorksheet('Expenses'),membersSheet=workbook.getWorksheet('Members'),settings=workbook.getWorksheet('Settings');
  const eh=header(expensesSheet,['id','date','description','total','paid']);
  const mh=header(membersSheet,['id','name','annual','cash','sponsor']);
  const expenses=[],members=[];
  for(let i=eh.index+1;i<=expensesSheet.rowCount;i++) {
    const row=expensesSheet.getRow(i),c=name=>row.getCell(eh.columns[name]||16384);
    if(!text(c('id'))||!text(c('description')))continue;
    const entry={id:text(c('id')),date:date(c('date')),description:text(c('description')),total:number(c('total')),paid:number(c('paid')),payer:text(c('payer')),source:text(c('source')),remarks:text(c('remarks')),sponsorName:text(c('sponsor')),category:text(c('category'))||'Event expenses'};
    if(text(c('dueDate')))entry.dueDate=date(c('dueDate'));
    const reimbursed=cellValue(c('reimbursed'));
    if(reimbursed!==null&&reimbursed!==undefined&&reimbursed!=='')entry.reimbursed=number(c('reimbursed'));
    expenses.push(entry);
  }
  for(let i=mh.index+1;i<=membersSheet.rowCount;i++) {
    const row=membersSheet.getRow(i),c=name=>row.getCell(mh.columns[name]||16384);
    if(!text(c('id'))||!text(c('name')))continue;
    members.push({id:text(c('id')),name:text(c('name')),annual:number(c('annual')),cash:number(c('cash')),sponsor:number(c('sponsor'))});
  }
  let openingFund;
  settings.eachRow(row=>row.eachCell((cell,i)=>{
    if(text(cell).toLowerCase().replace(/[^a-z]/g,'')==='openingfund')openingFund=number(row.getCell(i+1));
  }));
  if(openingFund===undefined)throw new Error('Opening fund is missing from the Settings tab.');
  if(!expenses.length||!members.length)throw new Error('The Sheet has no expense or member records.');
  const additionalTransactions=[],budgets={};
  const extraSheet=workbook.getWorksheet('Transactions');
  if(extraSheet){
    const h=header(extraSheet,['id','date','name','amount','type','category']);
    for(let i=h.index+1;i<=extraSheet.rowCount;i++){
      const row=extraSheet.getRow(i),c=name=>row.getCell(h.columns[name]);if(!text(c('id')))continue;
      additionalTransactions.push({id:text(c('id')),date:date(c('date')),name:text(c('name')),amount:number(c('amount')),type:text(c('type')),category:text(c('category'))});
    }
  }
  const budgetSheet=workbook.getWorksheet('Budgets');
  if(budgetSheet){
    const h=header(budgetSheet,['month','amount']);
    for(let i=h.index+1;i<=budgetSheet.rowCount;i++){const row=budgetSheet.getRow(i),month=text(row.getCell(h.columns.month));if(month)budgets[month]=number(row.getCell(h.columns.amount));}
  }
  return importDatabase({format:'budget-tracking-database-v1',title:'Durgamatha 2026',currency:'INR',openingFund,reportingMonth:expenses.map(e=>e.date.slice(0,7)).sort()[0],advanceRule:'personal-advance-only',expenses,members,additionalTransactions,budgets});
}
export async function parseExcel(buffer) {
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if(workbook.getWorksheet('Expenses')&&workbook.getWorksheet('Members')&&workbook.getWorksheet('Settings'))return parseDatabaseWorkbook(workbook);
  const expensesSheet=workbook.getWorksheet('Expenses'),membersSheet=workbook.getWorksheet('Member Funds');
  if(!expensesSheet||!membersSheet)throw new Error('The workbook needs Expenses and Member Funds sheets. Available sheets: '+workbook.worksheets.map(s=>s.name).join(', '));
  const eh=header(expensesSheet,['Date','Description','Total Amount','Amount Paid','Paid By','Funding Source']);
  const mh=header(membersSheet,['Member','Annual Due','Cash Given','Sponsor Amount']);
  const expenses=[],members=[];
  for(let i=eh.index+1;i<=expensesSheet.rowCount;i++) {
    const row=expensesSheet.getRow(i),c=name=>row.getCell(eh.columns[name]||16384);
    const description=text(c('Description'));
    if(!description||description.toLowerCase()==='total')continue;
    expenses.push({id:'exp-'+i,date:date(c('Date')),description,total:number(c('Total Amount')),paid:number(c('Amount Paid')),payer:text(c('Paid By')),source:text(c('Funding Source')),remarks:text(c('Remarks')),sponsorName:text(c('Sponsor Name')),reimbursed:number(c('Reimbursed Amount')),dueDate:date(c('Due Date'))});
  }
  for(let i=mh.index+1;i<=membersSheet.rowCount;i++) {
    const row=membersSheet.getRow(i),c=name=>row.getCell(mh.columns[name]||16384);
    const name=text(c('Member'));
    if(!name||name.toLowerCase()==='total')continue;
    members.push({id:'member-'+i,name,annual:number(c('Annual Due')),cash:number(c('Cash Given')),sponsor:number(c('Sponsor Amount')),remarks:text(c('Remarks'))});
  }
  let openingFund;
  membersSheet.eachRow(row=>row.eachCell((cell,i)=>{
    if(text(cell).startsWith('Opening Fund'))openingFund=number(row.getCell(i+1));
  }));
  if(openingFund===undefined)throw new Error('The opening fund could not be found.');
  if(!expenses.length||!members.length)throw new Error('No expense or member rows were found.');
  const reportingMonth=expenses.map(e=>e.date.slice(0,7)).sort()[0];
  const data={format:'budget-tracking-database-v1',title:'Durgamatha 2026',currency:'INR',openingFund,reportingMonth,advanceRule:'all-payers',expenses,members,notes:'Imported from Excel. Opening fund and member collections have no source dates; the reporting month’s first day is used. Workbook advances include every expense assigned to a member, including Collected Fund payments. This differs from a Personal Advance-only rule and may double-count fund payments as liabilities.'};
  return importDatabase(data);
}
