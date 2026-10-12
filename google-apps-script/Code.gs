// Deploy as a Web app: execute as Me, access Anyone. Writes require an editor key.
// The app URL and Sheet are public; never put the editor key in website files.
var SHEET_ID = '1Sh6dzbE8XExVR076xRYs2F-i6VaERBJBlyclSWFilNk';
var APP_ORIGIN = 'https://nakkasandeepgoud.github.io';

function setupBudgetDatabase() {
  var book = SpreadsheetApp.openById(SHEET_ID);
  ['Expenses','Members','Settings'].forEach(function(name) {
    if (!book.getSheetByName(name)) throw new Error('Missing existing Sheet tab: '+name);
  });
  table_(book,'Transactions',['id','date','name','amount','type','category']);
  table_(book,'Budgets',['month','amount']);
  if (!PropertiesService.getScriptProperties().getProperty('EDITOR_KEY_HASH')) rotateEditorKey();
  else SpreadsheetApp.getUi().alert('Database prepared. Your existing editor key remains unchanged.');
}

function rotateEditorKey() {
  var key = Utilities.getUuid()+Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('EDITOR_KEY_HASH',hash_(key));
  SpreadsheetApp.getUi().alert('Copy this editor key to your password manager. Enter it only in the budget app’s Unlock editing dialog. It will not be displayed again.\n\n'+key);
}

function doGet(e) { return response_(process_({action:'read',requestId:e.parameter.requestId||''})); }
function doPost(e) {
  var request={};
  try {
    if (!e.parameter.payload || e.parameter.payload.length>30000) throw new Error('Invalid request size.');
    request=JSON.parse(e.parameter.payload);
    return response_(process_(request));
  } catch(error) {
    return response_({marker:'budget-sheet-response',requestId:request.requestId||'',ok:false,error:error.message});
  }
}
function response_(result) {
  var json=JSON.stringify(result).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><script>window.top.postMessage('+json+','+JSON.stringify(APP_ORIGIN)+');</script>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function process_(request) {
  var result={marker:'budget-sheet-response',requestId:request.requestId||'',ok:false};
  var lock=LockService.getScriptLock();
  try {
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(request.requestId||'')) throw new Error('Invalid request identifier.');
    lock.waitLock(10000);
    var book=SpreadsheetApp.openById(SHEET_ID), snapshot=snapshot_(book);
    if(request.action!=='read') {
      var expected=PropertiesService.getScriptProperties().getProperty('EDITOR_KEY_HASH');
      if(!expected||typeof request.editorKey!=='string'||!constantEqual_(hash_(request.editorKey),expected)) throw new Error('Editor key is incorrect. Unlock editing with the key generated in Google Apps Script.');
      var cache=CacheService.getScriptCache(), cached=cache.get('write-'+request.requestId);
      var fingerprint=hash_(JSON.stringify({action:request.action,data:request.data}));
      if(cached) {
        if(cached!==fingerprint)throw new Error('Request identifier was reused with different data.');
      } else {
        if(request.revision!==snapshot.revision)throw new Error('The Sheet changed since you loaded it. Refresh data before saving again.');
        mutate_(book,request.action,request.data||{});
        SpreadsheetApp.flush();
        cache.put('write-'+request.requestId,fingerprint,21600);
      }
      snapshot=snapshot_(book);
    }
    result.ok=true;result.database=snapshot;
  }catch(error){result.error=error.message;}
  finally{if(lock.hasLock())lock.releaseLock();}
  return result;
}
function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8)
    .map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
}
function constantEqual_(a,b) {
  var difference=a.length^b.length;
  for(var i=0;i<a.length;i++)difference|=a.charCodeAt(i)^(b.charCodeAt(i)||0);
  return difference===0;
}
function rows_(book,name) {
  var sheet=book.getSheetByName(name);
  if(!sheet)return [];
  var values=sheet.getDataRange().getValues(), headers=values.shift().map(String);
  return values.filter(function(row){return row.some(function(v){return v!=='';});}).map(function(row){
    var record={};headers.forEach(function(key,i){record[key]=row[i];});return record;
  });
}
function iso_(value) {
  if(value instanceof Date)return Utilities.formatDate(value,'UTC','yyyy-MM-dd');
  return String(value||'');
}
function snapshot_(book) {
  var expenses=rows_(book,'Expenses').filter(function(e){return e.id&&e.description;}).map(function(e){
    var expense={id:String(e.id),date:iso_(e.date),description:String(e.description),total:Number(e.total),paid:Number(e.paid),payer:String(e.payer||''),source:String(e.source||''),remarks:String(e.remarks||''),sponsorName:String(e.sponsor||''),category:String(e.category||'Event expenses')};
    if(e.reimbursed!==undefined&&e.reimbursed!=='')expense.reimbursed=Number(e.reimbursed);
    if(e.dueDate)expense.dueDate=iso_(e.dueDate);
    return expense;
  });
  var members=rows_(book,'Members').filter(function(m){return m.id&&m.name;}).map(function(m){return {id:String(m.id),name:String(m.name),annual:Number(m.annual),cash:Number(m.cash),sponsor:Number(m.sponsor)};});
  var settings=book.getSheetByName('Settings').getDataRange().getValues(),opening=0;
  settings.forEach(function(row){if(String(row[0]).toLowerCase().replace(/[^a-z]/g,'')==='openingfund')opening=Number(row[1]);});
  var extra=rows_(book,'Transactions').map(function(t){return {id:String(t.id),date:iso_(t.date),name:String(t.name),amount:Number(t.amount),type:String(t.type),category:String(t.category)};});
  var budgets={};rows_(book,'Budgets').forEach(function(b){budgets[String(b.month)]=Number(b.amount);});
  var month=expenses.map(function(e){return e.date.slice(0,7);}).sort()[0]||Utilities.formatDate(new Date(),'UTC','yyyy-MM');
  var data={format:'budget-tracking-database-v1',title:'Durgamatha 2026',currency:'INR',sheetId:SHEET_ID,reportingMonth:month,openingFund:opening,advanceRule:'personal-advance-only',expenses:expenses,members:members,additionalTransactions:extra,budgets:budgets};
  data.revision=hash_(JSON.stringify(data));return data;
}
function money_(value,label) {
  if(typeof value!=='number'||!isFinite(value)||value<0||value>1000000000||Math.abs(value*100-Math.round(value*100))>0.0001)throw new Error(label+' must be a nonnegative amount with up to two decimal places.');
  return value;
}
function id_(value) {if(typeof value!=='string'||!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,99}$/.test(value))throw new Error('Invalid record ID.');return value;}
function text_(value,label,limit,optional) {
  if(typeof value!=='string'||value.length>limit||(!optional&&!value.trim()))throw new Error('Invalid '+label+'.');
  // Prevent spreadsheet formula execution in user-supplied text.
  if(/^[=+@-]/.test(value))throw new Error(label+' must not start with a formula character.');
  return value.trim();
}
function date_(value,optional) {
  if(optional&&!value)return '';
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('Invalid date.');
  return value;
}
function table_(book,name,headers) {
  var sheet=book.getSheetByName(name);
  if(!sheet){sheet=book.insertSheet(name);sheet.appendRow(headers);}
  var existing=sheet.getDataRange().getValues()[0].map(String);
  headers.forEach(function(h){if(existing.indexOf(h)<0){existing.push(h);sheet.getRange(1,existing.length).setValue(h);}});
  return sheet;
}
function upsert_(book,name,record,key) {
  key=key||'id';
  var sheet=table_(book,name,Object.keys(record)),values=sheet.getDataRange().getValues(),headers=values[0].map(String),column=headers.indexOf(key);
  var row=values.findIndex(function(r,i){return i>0&&String(r[column])===String(record[key]);});
  var result=row>0?values[row].slice():headers.map(function(){return '';});
  headers.forEach(function(h,i){if(Object.prototype.hasOwnProperty.call(record,h))result[i]=record[h];});
  if(row>0)sheet.getRange(row+1,1,1,headers.length).setValues([result]);else sheet.appendRow(result);
}
function delete_(book,name,id) {
  id_(id);var sheet=book.getSheetByName(name);
  if(!sheet)throw new Error('Record not found.');
  var rows=sheet.getDataRange().getValues(),col=rows[0].map(String).indexOf('id');
  var row=rows.findIndex(function(r,i){return i>0&&String(r[col])===id;});
  if(row<1)throw new Error('Record not found.');sheet.deleteRow(row+1);
}
function mutate_(book,action,data) {
  if(action==='authorize')return;
  if(action==='upsertExpense') {
    var expense={id:id_(data.id),date:date_(data.date),description:text_(data.description,'description',100),total:money_(data.total,'Total'),paid:money_(data.paid,'Paid'),payer:text_(data.payer||'','payer',100,true),source:data.source,remarks:text_(data.remarks||'','remarks',500,true),sponsor:text_(data.sponsorName||'','sponsor',100,true),reimbursed:money_(data.reimbursed||0,'Reimbursement'),dueDate:date_(data.dueDate,true),category:text_(data.category||'Event expenses','category',100)};
    if(expense.paid>expense.total||expense.reimbursed>expense.paid)throw new Error('Paid cannot exceed total; reimbursement cannot exceed paid.');
    if(['Collected Fund','Personal Advance','Sponsor',''].indexOf(expense.source)<0)throw new Error('Invalid funding source.');
    if(expense.payer&&!rows_(book,'Members').some(function(m){return m.name===expense.payer;}))throw new Error('Choose an existing member as payer.');
    if(expense.source==='Personal Advance'&&!expense.payer)throw new Error('Personal advances require a payer.');
    if(expense.source==='Sponsor'&&!expense.sponsor)throw new Error('Sponsored expenses require a sponsor name.');
    upsert_(book,'Expenses',expense);
  }else if(action==='deleteExpense')delete_(book,'Expenses',data.id);
  else if(action==='upsertTransaction') {
    var transaction={id:id_(data.id),date:date_(data.date),name:text_(data.name,'description',100),amount:money_(data.amount,'Amount'),type:data.type,category:text_(data.category,'category',100)};
    if(transaction.amount<=0||transaction.type!=='income')throw new Error('Use expense records for expenses. Income must be positive.');
    upsert_(book,'Transactions',transaction);
  }else if(action==='deleteTransaction')delete_(book,'Transactions',data.id);
  else if(action==='upsertMember') {
    var member={id:id_(data.id),name:text_(data.name,'member name',100),annual:money_(data.annual,'Annual due'),cash:money_(data.cash,'Cash contribution'),sponsor:money_(data.sponsor,'Sponsorship')};
    var existing=rows_(book,'Members');
    if(existing.some(function(m){return m.id!==member.id&&m.name===member.name;}))throw new Error('Member name already exists.');
    if(existing.some(function(m){return m.id===member.id&&m.name!==member.name;}))throw new Error('Existing member names cannot be changed because expenses reference them.');
    upsert_(book,'Members',member);
  }else if(action==='setBudget') {
    if(typeof data.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.month))throw new Error('Invalid budget month.');
    upsert_(book,'Budgets',{month:data.month,amount:money_(data.amount,'Budget')},'month');
  }else if(action==='setOpeningFund') {
    var amount=money_(data.amount,'Opening fund'),sheet=book.getSheetByName('Settings'),values=sheet.getDataRange().getValues();
    var row=values.findIndex(function(r){return String(r[0]).toLowerCase().replace(/[^a-z]/g,'')==='openingfund';});
    if(row<0)throw new Error('Opening fund setting not found.');sheet.getRange(row+1,2).setValue(amount);
  }else throw new Error('Unsupported operation.');
}
