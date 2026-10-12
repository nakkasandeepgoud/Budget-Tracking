import {sheetRequest} from './sheet-api.js';
let editorKey='', busy=false, message='', expenseId='', extraId='';

function field(label,name,value='',type='text',attributes='') {
  const element=document.createElement('label');element.textContent=label;
  const input=document.createElement('input');input.type=type;input.name=name;input.value=value;
  if(type==='number'){input.min='0';input.step='0.01';}
  if(attributes==='required')input.required=true;
  if(attributes==='readonly')input.readOnly=true;
  element.append(input);return element;
}
export function mountSheetEditor({state,apiUrl,applySnapshot,render}) {
  if(!apiUrl)return;
  const app=document.querySelector('#app'),actions=document.querySelector('.heading-actions');
  const status=document.createElement('p');status.className='shared-notice';status.role='status';status.textContent=message||'Google Sheets database · Changes save to the Sheet after confirmation. Unlock editing to make changes.';
  document.querySelector('.heading').after(status);
  const lockButton=document.createElement('button');lockButton.className='secondary';lockButton.textContent=editorKey?'Lock editing':'Unlock editing';actions.prepend(lockButton);
  const refreshButton=document.createElement('button');refreshButton.className='secondary';refreshButton.textContent='Refresh data';actions.prepend(refreshButton);
  async function call(action,data,key=editorKey) {
    if(busy)throw new Error('A Sheet operation is already in progress.');
    busy=true;status.textContent=action==='read'?'Refreshing Google Sheets…':'Waiting for Google Sheets to confirm…';
    app.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
      const snapshot=await sheetRequest(apiUrl,action,data,{editorKey:key,revision:state.database?.revision});
      message=action==='read'?'Shared data refreshed from Google Sheets.':action==='authorize'?'Editing unlocked for this tab.':'Saved in Google Sheets. Other viewers refresh automatically.';
      return snapshot;
    }catch(error){message=error.message;status.textContent=message;const form=document.querySelector('dialog[open] form');if(form){let p=form.querySelector('.sync-error');if(!p){p=document.createElement('p');p.className='sync-error';p.role='alert';form.append(p);}p.textContent=message;}throw error;}
    finally{busy=false;app.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  refreshButton.onclick=async()=>{try{applySnapshot(await call('read',{}));}catch{}};
  lockButton.onclick=()=>{
    if(editorKey){editorKey='';message='Editing locked.';render();return;}
    const dialog=document.createElement('dialog'),form=document.createElement('form');
    const title=document.createElement('h3');title.textContent='Unlock editing';form.append(title,field('Editor key','editorKey','','password','required'));
    const submit=document.createElement('button');submit.className='primary';submit.textContent='Unlock';
    const cancel=document.createElement('button');cancel.className='secondary';cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>dialog.remove();
    const error=document.createElement('p');error.role='alert';form.append(error,submit,cancel);dialog.append(form);app.append(dialog);dialog.showModal();
    form.onsubmit=async event=>{event.preventDefault();const key=form.elements.editorKey.value;try{const snapshot=await call('authorize',{},key);editorKey=key;form.elements.editorKey.value='';applySnapshot(snapshot);}catch(e){error.textContent=e.message;}};
  };
  if(!editorKey)return;
  const database=state.database;
  const note=document.querySelector('.database-note');if(note)note.textContent='These records come from Google Sheets and update after confirmed saves. Only paid expenses reduce collected cash when their source is Collected Fund. Personal advances remain separate. Undated opening funds and member collections use the reporting month’s first day.';
  if(!database?.revision)return;
  document.querySelectorAll('#add,#first-add,#edit-budget').forEach(b=>b.hidden=false);
  const transactionForm=document.querySelector('#transaction-form'),expenseFields=document.createElement('div');
  expenseFields.id='expense-fields';
  transactionForm.elements.category.prepend(new Option('Event expenses','Event expenses',true,true));
  expenseFields.append(field('Total committed','total','','number','required'));
  const sourceLabel=document.createElement('label');sourceLabel.textContent='Funding source';const source=document.createElement('select');source.name='source';
  for(const value of ['Collected Fund','Personal Advance','Sponsor','']){const option=new Option(value||'Not decided',value);source.append(option);}sourceLabel.append(source);expenseFields.append(sourceLabel);
  const payerLabel=document.createElement('label');payerLabel.textContent='Paid by';const payer=document.createElement('select');payer.name='payer';payer.append(new Option('Committee / unspecified',''));for(const m of database.members)payer.append(new Option(m.name,m.name));payerLabel.append(payer);expenseFields.append(payerLabel);
  expenseFields.append(field('Sponsor name','sponsorName'),field('Reimbursed amount','reimbursed',0,'number'),field('Due date','dueDate','','date'),field('Remarks','remarks'));
  transactionForm.querySelector('button[type="submit"]').before(expenseFields);
  function setType(){const expense=transactionForm.elements.type.value==='expense';expenseFields.hidden=!expense;transactionForm.elements.total.required=expense;transactionForm.elements.amount.min=expense?'0':'0.01';}
  transactionForm.elements.type.onchange=setType;
  transactionForm.elements.amount.oninput=()=>{if(!transactionForm.elements.total.dataset.manual)transactionForm.elements.total.value=transactionForm.elements.amount.value;};
  transactionForm.elements.total.oninput=()=>transactionForm.elements.total.dataset.manual='true';
  function openExpense(expense) {
    transactionForm.reset();expenseId=expense?.id||'exp-'+crypto.randomUUID();extraId='tx-'+crypto.randomUUID();
    transactionForm.elements.type.disabled=Boolean(expense);transactionForm.elements.type.value=expense?'expense':'expense';
    if(expense){
      transactionForm.elements.name.value=expense.description;transactionForm.elements.date.value=expense.date;
      transactionForm.elements.amount.value=expense.paid;transactionForm.elements.total.value=expense.total;
      transactionForm.elements.total.dataset.manual='true';transactionForm.elements.source.value=expense.source;
      transactionForm.elements.payer.value=expense.payer;const category=expense.category||'Event expenses';if(![...transactionForm.elements.category.options].some(o=>o.value===category))transactionForm.elements.category.append(new Option(category,category));transactionForm.elements.category.value=category;transactionForm.elements.sponsorName.value=expense.sponsorName||'';
      transactionForm.elements.reimbursed.value=expense.reimbursed||0;transactionForm.elements.dueDate.value=expense.dueDate||'';transactionForm.elements.remarks.value=expense.remarks||'';
    }else{delete transactionForm.elements.total.dataset.manual;}
    setType();document.querySelector('#transaction-dialog').showModal();
  }
  for(const id of ['add','first-add'])document.getElementById(id)?.addEventListener('click',event=>{event.stopImmediatePropagation();openExpense();},true);
  transactionForm.addEventListener('submit',async event=>{
    event.preventDefault();event.stopImmediatePropagation();
    const form=transactionForm.elements,expense=form.type.value==='expense';
    const data=expense?{id:expenseId,date:form.date.value,description:form.name.value.trim(),paid:Number(form.amount.value),total:Number(form.total.value),source:form.source.value,payer:form.payer.value,sponsorName:form.sponsorName.value.trim(),reimbursed:Number(form.reimbursed.value),dueDate:form.dueDate.value,remarks:form.remarks.value.trim(),category:form.category.value}:{id:extraId,date:form.date.value,name:form.name.value.trim(),amount:Number(form.amount.value),type:'income',category:form.category.value};
    try{applySnapshot(await call(expense?'upsertExpense':'upsertTransaction',data),data.date.slice(0,7));}catch{}
  },true);
  const budgetForm=document.querySelector('#budget-form');
  budgetForm.addEventListener('submit',async event=>{event.preventDefault();event.stopImmediatePropagation();try{applySnapshot(await call('setBudget',{month:document.querySelector('#month').value,amount:Number(budgetForm.elements.budget.value)}));}catch{}},true);
  async function remove(action,id){if(!confirm('Delete this record from Google Sheets for everyone?'))return;try{applySnapshot(await call(action,{id}));}catch{}}
  document.querySelectorAll('.transactions .delete').forEach(button=>{
    const id=button.dataset.id;
    if(id.startsWith('sheet-extra-')){const edit=document.createElement('button');edit.className='secondary';edit.textContent='Edit';edit.onclick=()=>{const t=state.transactions.find(t=>t.id===id);transactionForm.reset();extraId=id.slice(12);transactionForm.elements.type.value='income';transactionForm.elements.type.disabled=true;transactionForm.elements.name.value=t.name;transactionForm.elements.amount.value=t.amount;transactionForm.elements.date.value=t.date;if(![...transactionForm.elements.category.options].some(o=>o.value===t.category))transactionForm.elements.category.append(new Option(t.category,t.category));transactionForm.elements.category.value=t.category;setType();document.querySelector('#transaction-dialog').showModal();};button.before(edit);button.hidden=false;button.addEventListener('click',e=>{e.stopImmediatePropagation();remove('deleteTransaction',id.slice(12));},true);}
    else if(database.expenses.some(e=>'database-'+e.id===id)){button.hidden=false;button.addEventListener('click',e=>{e.stopImmediatePropagation();remove('deleteExpense',id.slice(9));},true);}
  });
  const details=document.querySelectorAll('.database-panel details');
  const expenseRows=details[0]?.querySelectorAll('tbody tr');
  expenseRows?.forEach((row,i)=>{
    const cell=document.createElement('td'),edit=document.createElement('button'),del=document.createElement('button');
    edit.className=del.className='secondary';edit.textContent='Edit';del.textContent='Delete';edit.onclick=()=>openExpense(database.expenses[i]);del.onclick=()=>remove('deleteExpense',database.expenses[i].id);cell.append(edit,del);row.append(cell);
  });
  function memberDialog(member) {
    const dialog=document.createElement('dialog'),form=document.createElement('form');
    const title=document.createElement('h3');title.textContent=member?'Edit member contributions':'Add member';
    form.append(title,field('Member name','name',member?.name||'','text',member?'readonly':'required'),field('Annual contribution','annual',member?.annual??3000,'number','required'),field('Cash collected','cash',member?.cash??0,'number','required'),field('Sponsor contribution','sponsor',member?.sponsor??0,'number','required'));
    const submit=document.createElement('button');submit.className='primary';submit.textContent='Save to Google Sheets';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Cancel';cancel.onclick=()=>dialog.remove();form.append(submit,cancel);dialog.append(form);app.append(dialog);dialog.showModal();
    const id=member?.id||'member-'+crypto.randomUUID();
    form.onsubmit=async event=>{event.preventDefault();try{applySnapshot(await call('upsertMember',{id,name:form.elements.name.value.trim(),annual:Number(form.elements.annual.value),cash:Number(form.elements.cash.value),sponsor:Number(form.elements.sponsor.value)}));}catch{}};
  }
  details[1]?.querySelectorAll('tbody tr').forEach((row,i)=>{const cell=document.createElement('td'),edit=document.createElement('button');edit.className='secondary';edit.textContent='Edit';edit.onclick=()=>memberDialog(database.members[i]);cell.append(edit);row.append(cell);});
  const addMember=document.createElement('button');addMember.className='secondary';addMember.textContent='+ Add member';addMember.onclick=()=>memberDialog();details[1]?.append(addMember);
  const opening=document.createElement('button');opening.className='secondary';opening.textContent='Edit opening fund';opening.onclick=()=>{
    const value=prompt('Opening fund in INR',String(database.openingFund));if(value===null)return;
    const amount=Number(value);if(!Number.isFinite(amount)||amount<0){alert('Enter a nonnegative amount.');return;}
    call('setOpeningFund',{amount}).then(applySnapshot).catch(()=>{});
  };document.querySelector('.database-panel .panel-title').append(opening);
}

export function isSheetBusy(){return busy;}
