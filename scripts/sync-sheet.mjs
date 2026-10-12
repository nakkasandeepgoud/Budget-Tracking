import fs from 'node:fs/promises';
import {sheetId} from '../src/google.js';
import {parseExcel} from '../src/excel.js';

try {
const config=JSON.parse(await fs.readFile(new URL('../public/shared-source.json',import.meta.url),'utf8'));
const id=sheetId(config.sheetUrl);
const response=await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,{signal:AbortSignal.timeout(60000)});
if(!response.ok)throw new Error(`Google export failed (HTTP ${response.status}). The Sheet must allow Anyone with the link to view it.`);
const bytes=await response.arrayBuffer();
if(bytes.byteLength>5_000_000)throw new Error('The shared workbook exceeds 5 MB.');
if(new Uint8Array(bytes)[0]!==0x50||new Uint8Array(bytes)[1]!==0x4b)throw new Error('Google returned a sign-in page, not an Excel workbook.');
const imported=await parseExcel(bytes);
imported.database.syncedAt=new Date().toISOString();
await fs.writeFile(new URL('../public/shared-data.json',import.meta.url),JSON.stringify(imported.database,null,2));
console.log(`Synchronized ${imported.database.expenses.length} expenses and ${imported.database.members.length} members.`);

} catch(error) {
 console.error('::error::'+String(error.message).replace(/[\r\n]/g,' '));
 process.exitCode=1;
}
