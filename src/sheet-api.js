export function validateApiUrl(value) {
  let url;try{url=new URL(value);}catch{throw new Error('Invalid Google Apps Script deployment URL.');}
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.hash)throw new Error('Use the Google Apps Script Web app URL ending in /exec.');
  return url.href;
}
export function trustedScriptOrigin(origin) {
  return /^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/.test(origin);
}
export function sheetRequest(endpoint,action,data={},options={}) {
  const url=validateApiUrl(endpoint),requestId=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    const iframe=document.createElement('iframe'),form=document.createElement('form'),input=document.createElement('input');
    iframe.name='sheet-'+requestId;iframe.hidden=true;iframe.title='Google Sheets connection';
    form.action=url;form.method='POST';form.target=iframe.name;form.hidden=true;
    input.type='hidden';input.name='payload';input.value=JSON.stringify({requestId,action,data,revision:options.revision,editorKey:options.editorKey});
    form.append(input);
    function cleanup(){clearTimeout(timer);window.removeEventListener('message',receive);input.value='';form.remove();iframe.remove();}
    function receive(event){
      const response=event.data;
      if(!trustedScriptOrigin(event.origin)||!response||response.marker!=='budget-sheet-response'||response.requestId!==requestId)return;
      cleanup();if(response.ok&&response.database)resolve(response.database);else reject(new Error(response.error||'Google Sheets rejected the operation.'));
    }
    const timer=setTimeout(()=>{cleanup();reject(new Error('Google did not confirm this operation. Refresh data before retrying; a timed-out write may have succeeded.'));},60000);
    window.addEventListener('message',receive);
    document.body.append(iframe,form);
    try{form.submit();}catch(error){cleanup();reject(error);}
  });
}
