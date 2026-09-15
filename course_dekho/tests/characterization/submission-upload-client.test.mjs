import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Compile the existing browser client without introducing another test dependency.
const source = await readFile(new URL('../../lib/client/workspace-api.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { createSubmission } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('upload reports actual progress but resolves only after the server accepts the submission', async t => {
  const instances = [];
  class FakeXHR {
    upload = {};
    constructor() { instances.push(this); }
    open(method, url) { assert.equal(method, 'POST'); assert.equal(url, '/api/v1/submissions'); }
    setRequestHeader(name) { assert.notEqual(name.toLowerCase(), 'content-type'); }
    send(body) { this.body = body; }
  }
  const original = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXHR;
  t.after(() => { if (original === undefined) delete globalThis.XMLHttpRequest; else globalThis.XMLHttpRequest = original; });
  const values = [];
  let resolved = false;
  const pending = createSubmission({ title: 'Notes', file: new File(['notes'], 'notes.txt') }, percent => values.push(percent)).then(value => { resolved = true; return value; });
  const xhr = instances[0];
  assert.equal(xhr.body.get('file').name, 'notes.txt');
  xhr.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 });
  xhr.upload.onprogress({ lengthComputable: true, loaded: 10, total: 10 });
  await Promise.resolve();
  assert.deepEqual(values, [50, 100]);
  assert.equal(resolved, false);
  xhr.status = 201; xhr.responseText = JSON.stringify({ data: { id: 'submission', status: 'pending' } }); xhr.onload();
  assert.deepEqual(await pending, { id: 'submission', status: 'pending' });
  const failed = createSubmission({ title: 'Invalid' }, () => {});
  const failedXhr = instances[1];
  failedXhr.status = 400; failedXhr.responseText = JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid', fieldErrors: { file: ['File is too large.'] } } }); failedXhr.onload();
  await assert.rejects(failed, /File is too large/);
});
