export function sheetId(value) {
  if(typeof value!=='string')throw new Error('Enter a Google Sheets link.');
  let url;
  try{url=new URL(value);}catch{throw new Error('Enter a complete Google Sheets URL.');}
  const match=url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||!match||match[1]==='e')throw new Error('Use the standard https://docs.google.com/spreadsheets/d/... link, not a published CSV link.');
  return match[1];
}
export function sheetLink(id) {
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Invalid Google Sheet ID.');
  return 'https://docs.google.com/spreadsheets/d/'+id+'/edit';
}
export async function loadGoogleSheet(url) {
  const id=sheetId(url);
  let response;
  try{response=await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(30000)});}
  catch{throw new Error('The Google Sheet could not be read. Enable Anyone with the link → Viewer, then retry. Google or your browser may also block cross-origin downloads.');}
  if(!response.ok)throw new Error('Google did not allow reading this Sheet. Check its sharing settings and link.');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength>5_000_000)throw new Error('The shared workbook exceeds the 5 MB limit.');
  if(new Uint8Array(bytes)[0]!==0x50||new Uint8Array(bytes)[1]!==0x4b)throw new Error('Google returned a sign-in page instead of a workbook. Make the Sheet readable without signing in.');
  return (await import('./excel.js')).parseExcel(bytes);
}
