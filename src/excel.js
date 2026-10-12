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
  throw new Error(`Missing expected columns in the ${sheet.name} sheet.`);
}
export async function parseExcel(buffer) {
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const expensesSheet=workbook.getWorksheet('Expenses'),membersSheet=workbook.getWorksheet('Member Funds');
  if(!expensesSheet||!membersSheet)throw new Error('The workbook needs Expenses and Member Funds sheets.');
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
