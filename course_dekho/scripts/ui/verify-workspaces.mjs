// Headless visual acceptance checks with explicit fixtures; no database writes.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const origin = 'http://localhost:3002';
const output = resolve('.data/ui-check');
await mkdir(output, { recursive: true });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9335', `--user-data-dir=${resolve('.data/ui-check/browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await (await fetch('http://localhost:9335/json/list')).json(); if (tabs.some(tab => tab.type === 'page')) break; } catch {} await delay(250); }
  assert.ok(tabs, 'Browser debugging endpoint not available');
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
  let role = 'admin';
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const university = { id: id(201), name: 'Northbridge University', shortName: 'NBU' };
  const semester = { id: id(301), universityId: id(201), name: 'Semester 3', sortOrder: 3 };
  const courses = ['Data Structures & Algorithms', 'Database Management Systems', 'Object Oriented Programming'].map((name, i) => ({ id: id(401 + i), code: `CSE-${211 + i}`, name, description: 'Build your foundations with a structured roadmap and reviewed learning materials.', university, semester }));
  const submissions = ['Graph traversal — lecture notes', 'SQL joins and normalization', 'Array practice problems', 'Binary search explained', 'Database design slides'].map((title, i) => ({ id: id(701 + i), title, contributor: { id: id(102), name: 'Ayesha Rahman' }, resourceType: i === 4 ? 'slide' : 'study_material', description: 'A practical guide with worked examples, illustrations and questions for independent study.', courseId: courses[i % 3].id, courseCode: courses[i % 3].code, topicId: id(501), topicName: 'Core concepts', status: ['pending', 'pending', 'approved', 'rejected', 'approved'][i], submittedAt: '2026-09-14T10:00:00Z', reviewedBy: null, reviewedAt: null, rejectionReason: i === 3 ? 'Please include references and improve the diagram labels.' : null }));
  const errors = [];
  let created = false;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const entry = pending.get(message.id); pending.delete(message.id); if (message.error) entry?.reject(new Error(JSON.stringify(message.error))); else entry?.resolve(message.result); return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const path = new URL(request.url).pathname;
      let data = [];
      if (path === '/api/v1/session') data = { id: id(101), name: 'Ayesha Rahman', username: 'ayesha', email: 'ayesha@example.test', role };
      else if (path === '/api/v1/admin/stats') data = { userCount: 48, courseCount: 3, publishedResourceCount: 24, submissionCount: 5 };
      else if (path.includes('/attachment')) data = { fileUrl: null, fileName: null, mimeType: null, externalUrl: 'https://example.test/material' };
      else if (path === '/api/v1/admin/submissions' || path === '/api/v1/submissions/mine') data = submissions;
      else if (path === '/api/v1/admin/users') data = [{ id: id(111), name: 'Tanvir Hasan', email: 'tanvir@example.test', username: 'tanvir', role: 'learner', universityName: university.name, registeredAt: '2026-09-14T10:00:00Z' }];
      else if (path === '/api/v1/courses') data = courses;
      else if (path.endsWith('/semesters')) data = [semester];
      else if (path.endsWith('/topics')) data = [{ id: id(501), name: 'Core concepts', courseId: courses[0].id, sequenceOrder: 1, subtopics: [] }];
      else if (path === '/api/v1/universities') data = [university];
      else if (path === '/api/v1/me/learning') data = { courses: courses.map((course, i) => ({ ...course, courseId: course.id, enrollmentId: id(1001 + i), progressPercent: [65, 35, 10][i], status: 'active' })), topics: [{ id: id(1501), topicId: id(501), courseId: id(401), courseName: courses[0].name, courseCode: courses[0].code, topicName: 'Graph traversal', progressPercent: 65, completed: false }] };
      else if (path === '/api/v1/me/access-history') data = submissions.slice(0, 3).map(row => ({ id: row.id, resourceId: row.id, resourceTitle: row.title, resourceType: row.resourceType, accessedAt: row.submittedAt }));
      else if (path === '/api/v1/admin/courses' && request.method === 'POST') { const body = JSON.parse(request.postData); assert.equal(body.code, 'CSE-999'); created = true; data = { id: id(999) }; }
      void send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'POST' ? 201 : 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ data })).toString('base64') });
    }
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://localhost:3002/api/v1/*' }] });
  async function evaluate(expression) { return (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value; }
  async function waitFor(expression) { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await delay(200); } throw new Error(`Timed out: ${expression}`); }
  async function navigate(path) { await send('Page.navigate', { url: origin + path }); await waitFor(`document.querySelector('.workspace-${role}') && !document.body.innerText.includes('Loading CourseDekho')`); await delay(1200); }
  async function screenshot(name) { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(resolve(output, name + '.png'), Buffer.from(result.data, 'base64')); }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1040, deviceScaleFactor: 1, mobile: false });
  for (role of ['admin', 'contributor', 'learner']) {
    await navigate('/dashboard');
    await screenshot(role + '-desktop');
    assert.equal(await evaluate('document.documentElement.scrollWidth > window.innerWidth'), false, `${role} overflow`);
    console.log(`PASS: ${role} desktop dashboard rendered without horizontal overflow`);
  }
  role = 'admin'; await navigate('/admin/courses');
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('New Course')).click()`);
  await waitFor(`document.querySelector('form')`);
  await evaluate(`(() => { const inputs=[...document.querySelectorAll('form input')]; for (const [i,v] of ['CSE-999','Browser verification'].entries()) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inputs[i],v); inputs[i].dispatchEvent(new Event('input',{bubbles:true})); } })()`);
  await delay(300);
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await waitFor(`document.body.innerText.includes('was created successfully')`);
  assert.ok(created); console.log('PASS: course form sends values and reports successful creation');
  role = 'contributor'; await navigate('/contributor/submissions');
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('New Submission')).click()`);
  await waitFor(`document.querySelector('input[type=file]')`);
  assert.equal(await evaluate(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Attach file'))`), true);
  await screenshot('contributor-submission-form');
  console.log('PASS: contributor attachment form opens');
  await navigate('/settings');
  await evaluate(`document.querySelector('input[role=switch]').click()`);
  await waitFor(`document.documentElement.dataset.density === 'compact'`);
  await navigate('/settings');
  assert.equal(await evaluate(`document.documentElement.dataset.density`), 'compact');
  console.log('PASS: display preference applies and survives navigation');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (role of ['admin', 'contributor', 'learner']) {
    await navigate('/dashboard');
    await screenshot(role + '-mobile');
    assert.equal(await evaluate('document.documentElement.scrollWidth > window.innerWidth'), false, `${role} mobile overflow`);
    await evaluate(`document.querySelector('[aria-label="Toggle navigation"]').click()`);
    await waitFor(`document.querySelector('.workspace-navigation.is-open')`);
    await evaluate(`document.querySelector('[aria-label="Close navigation"]').click()`);
    console.log(`PASS: ${role} mobile layout and navigation`);
  }
  assert.deepEqual(errors, []);
  console.log('Screenshots saved in .data/ui-check. API responses were test fixtures.');
} finally { socket?.close(); edge.kill(); }
