import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sheetId,sheetLink,loadGoogleSheet} from './google.js';
test('standard Google Sheets links are normalized without sharing query parameters',()=>{
 assert.equal(sheetId('https://docs.google.com/spreadsheets/d/abc_123-xyz/edit?usp=sharing'),'abc_123-xyz');
 assert.equal(sheetLink('abc_123-xyz'),'https://docs.google.com/spreadsheets/d/abc_123-xyz/edit');
});
test('unexpected hosts and publication links are rejected',()=>{
 for(const url of ['https://evil.test/spreadsheets/d/abc/edit','http://docs.google.com/spreadsheets/d/abc/edit','https://docs.google.com/spreadsheets/d/e/published/pub'])assert.throws(()=>sheetId(url));
 assert.throws(()=>sheetLink('../other'));
});
test('a Google login response is rejected before Excel parsing',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response('<html>Sign in</html>');
  await assert.rejects(()=>loadGoogleSheet('https://docs.google.com/spreadsheets/d/test/edit'),/sign-in page/);
 }finally{globalThis.fetch=original;}
});
