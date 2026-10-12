import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateApiUrl,trustedScriptOrigin} from './sheet-api.js';
test('only deployed Google Apps Script endpoints are accepted',()=>{
 assert.equal(validateApiUrl('https://script.google.com/macros/s/test_id/exec'),'https://script.google.com/macros/s/test_id/exec');
 for(const url of ['https://evil.test/macros/s/id/exec','https://script.google.com/macros/s/id/dev','https://script.google.com/macros/s/id/exec?key=secret'])assert.throws(()=>validateApiUrl(url));
});
test('responses must come from Apps Script origins',()=>{
 assert.equal(trustedScriptOrigin('https://script.google.com'),true);
 assert.equal(trustedScriptOrigin('https://a-123-script.googleusercontent.com'),true);
 assert.equal(trustedScriptOrigin('https://evil.test'),false);
 assert.equal(trustedScriptOrigin('https://script.google.com.evil.test'),false);
});
