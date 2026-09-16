// Headless visual acceptance checks with explicit fixtures; no database writes.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const origin = process.env.COURSEDEKHO_UI_ORIGIN || 'http://localhost:3002';
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
  const academic = (kind, id, parentId, name, extra = {}) => ({ kind, id, parentId, name, description: '', code: '', shortName: '', sequenceOrder: null, isActive: true, parentActive: true, ...extra });
  const academics = [
    academic('university', university.id, null, university.name, { shortName: university.shortName }),
    academic('semester', semester.id, university.id, semester.name, { sequenceOrder: 1 }),
    ...courses.map(course => academic('course', course.id, semester.id, course.name, { code: course.code })),
    academic('topic', id(501), courses[0].id, 'Arrays', { sequenceOrder: 1 }),
    academic('topic', id(502), courses[0].id, 'Trees', { sequenceOrder: 2 }),
  ];
  const errors = [];
  let created = false;
  const profileNames = { admin: 'Ayesha Rahman', contributor: 'Ayesha Rahman', learner: 'Ayesha Rahman' };
  let passwordChanges = 0;
  let passwordResets = 0;
  const supportTickets = [];
  const supportMessages = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const entry = pending.get(message.id); pending.delete(message.id); if (message.error) entry?.reject(new Error(JSON.stringify(message.error))); else entry?.resolve(message.result); return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const path = new URL(request.url).pathname;
      let data = [];
      if (path === '/api/v1/session' && role === 'guest') {
        void send('Fetch.fulfillRequest', { requestId, responseCode: 401, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } })).toString('base64') });
        return;
      }
      if (path === '/api/v1/session') data = { id: id(101), name: profileNames[role], username: 'ayesha', email: 'ayesha@example.test', role };
      else if (path === '/api/v1/me/profile') {
        if (request.method === 'PUT') profileNames[role] = JSON.parse(request.postData).name;
        data = { user: { id: id(101), name: profileNames[role], username: 'ayesha', email: 'ayesha@example.test', role }, university, department: 'CSE', yearOfStudy: role === 'learner' ? 2 : null, designation: role === 'contributor' ? 'Lecturer' : null };
      }
      else if (path === '/api/v1/me/password') { passwordChanges++; assert.equal(JSON.parse(request.postData).currentPassword, 'current test password'); data = null; }
      else if (path === '/api/v1/auth/reset-password') { passwordResets++; assert.equal(JSON.parse(request.postData).token, 'r'.repeat(43)); data = null; }
      else if (path.endsWith('/recovery')) data = { token: 'r'.repeat(43), expiresAt: '2026-09-17T00:30:00Z' };
      else if (path === '/api/v1/admin/users/all') data = [{ id: id(111), name: 'Tanvir Hasan', email: 'tanvir@example.test', username: 'tanvir', role: 'learner', universityName: university.name, registrationStatus: 'approved', isActive: true, createdAt: '2026-09-14T10:00:00Z' }];
      else if (path === '/api/v1/support' || path === '/api/v1/support/recovery') {
        if (request.method === 'POST') {
          const body = JSON.parse(request.postData);
          const ticket = { id: id(2001 + supportTickets.length), ownerRole: role, userId: role === 'guest' ? null : id(101), category: body.category ?? 'recovery', subject: body.subject ?? 'Account recovery request', contactName: body.name ?? 'Test learner', contactEmail: body.email ?? 'learner@example.test', accountIdentifier: body.identifier ?? null, status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          supportTickets.push(ticket); supportMessages.set(ticket.id, [{ id: '1', sender: 'requester', body: body.message, createdAt: ticket.createdAt }]);
          data = { id: ticket.id, ...(role === 'guest' ? { accessToken: 'g'.repeat(43) } : {}) };
        } else data = supportTickets.filter(ticket => role === 'admin' || ticket.ownerRole === role);
      }
      else if (path.startsWith('/api/v1/support/')) {
        const ticket = supportTickets.find(ticket => ticket.id === path.split('/').at(-1));
        const messages = supportMessages.get(ticket.id);
        if (request.method === 'POST') {
          const body = JSON.parse(request.postData);
          if (body.message) messages.push({ id: String(messages.length + 1), sender: role === 'admin' ? 'admin' : 'requester', body: body.message, createdAt: new Date().toISOString() });
          ticket.status = body.status ?? (role === 'admin' ? ticket.status : 'open');
        }
        data = { ticket, messages };
      }
      else if (path === '/api/v1/admin/academics') {
        data = academics;
        if (request.method === 'POST') {
          const body = JSON.parse(request.postData);
          const row = academics.find(row => row.id === body.id);
          if (body.action === 'create') {
            assert.equal(body.code, 'CSE-999'); assert.equal(body.parentId, semester.id);
            academics.push(academic('course', id(999), body.parentId, body.name, { code: body.code })); created = true;
          } else if (body.action === 'edit') { row.name = body.name; row.description = body.description; }
          else if (body.action === 'archive' || body.action === 'restore') row.isActive = body.action === 'restore';
          else if (body.action === 'move') {
            const siblings = academics.filter(item => item.kind === row.kind && item.parentId === row.parentId && item.isActive).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
            const other = siblings[siblings.indexOf(row) + (body.direction === 'up' ? -1 : 1)];
            [row.sequenceOrder, other.sequenceOrder] = [other.sequenceOrder, row.sequenceOrder];
          }
          data = { id: body.id ?? id(999) };
        } else data = [...academics].sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));
      }
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
  await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/v1/*` }] });
  async function evaluate(expression) { return (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value; }
  async function waitFor(expression) { for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(200); } throw new Error(`Timed out: ${expression}`); }
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
  async function choose(label, value) {
    await evaluate(`(() => { const select = [...document.querySelectorAll('label')].find(label => label.textContent.startsWith(${JSON.stringify(label)})).querySelector('select'); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    await delay(250);
  }
  async function clickButton(text, scope = 'main') {
    await evaluate(`[...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
    await delay(200);
  }
  await choose('University', university.id); await choose('Semester', semester.id);
  await clickButton('New course');
  await waitFor(`document.querySelector('form')`);
  await evaluate(`document.querySelector('input[name=code]').value = 'CSE-999'; document.querySelector('input[name=name]').value = 'Browser verification'; document.querySelector('form').requestSubmit()`);
  await waitFor(`document.body.innerText.includes('Courses updated successfully')`);
  assert.ok(created); console.log('PASS: course form sends values and reports successful creation');
  await clickButton('Topics', 'nav[aria-label="Academic sections"]');
  await choose('Course', courses[0].id);
  await evaluate(`document.querySelector('[aria-label="Move Trees up"]').click()`);
  await waitFor(`document.body.innerText.includes('Order updated.') && document.querySelector('main ul li')?.textContent.startsWith('1. Trees')`);
  await clickButton('Edit', 'main ul li');
  await waitFor(`document.querySelector('form input[name=name]')`);
  await evaluate(`document.querySelector('form input[name=name]').value = 'Tree traversal'; document.querySelector('form').requestSubmit()`);
  await waitFor(`document.body.innerText.includes('Topics updated successfully') && document.querySelector('main ul li')?.textContent.includes('Tree traversal')`);
  await clickButton('Archive', 'main ul li');
  await waitFor(`document.querySelector('[role=alertdialog]')`);
  await clickButton('Confirm archive', '[role=alertdialog]');
  await waitFor(`document.body.innerText.includes('Item archived.') && !document.querySelector('main ul')?.textContent.includes('Tree traversal')`);
  await evaluate(`document.querySelector('input[type=checkbox]').click()`);
  await waitFor(`[...document.querySelectorAll('main ul button')].some(b => b.textContent === 'Restore')`);
  await clickButton('Restore', 'main ul');
  await waitFor(`document.body.innerText.includes('Item restored.')`);
  await screenshot('academic-management-desktop');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth > window.innerWidth'), false, 'Academic management mobile overflow');
  await screenshot('academic-management-mobile');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1040, deviceScaleFactor: 1, mobile: false });
  console.log('PASS: topic edit, ordering, archive confirmation, restore, and responsive management layout');
  role = 'contributor'; await navigate('/contributor/submissions');
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('New Submission')).click()`);
  await waitFor(`document.querySelector('input[type=file]')`);
  assert.equal(await evaluate(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Attach file'))`), true);
  await screenshot('contributor-submission-form');
  console.log('PASS: contributor attachment form opens');
  await navigate('/settings');
  await evaluate(`(() => { const input = document.querySelector('input[role=switch]'); if (!input.checked) input.click(); })()`);
  await waitFor(`document.documentElement.dataset.density === 'compact'`);
  await navigate('/settings');
  assert.equal(await evaluate(`document.documentElement.dataset.density`), 'compact');
  console.log('PASS: display preference applies and survives navigation');
  for (role of ['admin', 'contributor', 'learner']) {
    await navigate('/profile');
    await clickButton('Edit profile');
    await waitFor(`document.querySelector('form input[name=name]')`);
    await evaluate(`document.querySelector('input[name=name]').value = 'Updated profile'; document.querySelector('form').requestSubmit()`);
    await waitFor(`document.body.innerText.includes('Profile saved.') && !document.querySelector('form')`);
    assert.equal(profileNames[role], 'Updated profile');
  }
  await navigate('/settings');
  await evaluate(`document.querySelector('[name=currentPassword]').value = 'current test password'; document.querySelector('[name=newPassword]').value = 'new test password'; document.querySelector('[name=confirmPassword]').value = 'mismatched password'; document.querySelector('form').requestSubmit()`);
  await waitFor(`document.body.innerText.includes('do not match')`);
  assert.equal(passwordChanges, 0);
  await evaluate(`document.querySelector('[name=confirmPassword]').value = 'new test password'; document.querySelector('form').requestSubmit()`);
  await waitFor(`document.body.innerText.includes('Your password has been updated.')`);
  assert.equal(passwordChanges, 1);
  role = 'admin'; await navigate('/admin/user-approvals');
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('All Users')).click()`);
  await clickButton('Recovery link');
  await waitFor(`document.querySelector('[aria-label="Account recovery"] form')`);
  await evaluate(`document.querySelector('[aria-label="Account recovery"] input[type=checkbox]').click(); document.querySelector('[name=currentPassword]').value = 'current test password'; document.querySelector('[aria-label="Account recovery"] form').requestSubmit()`);
  await waitFor(`document.querySelector('[aria-label="Account recovery"] input[readonly]')`);
  const recoveryUrl = await evaluate(`document.querySelector('[aria-label="Account recovery"] input[readonly]').value`);
  assert.ok(recoveryUrl.endsWith('#token=' + 'r'.repeat(43)));
  await send('Page.navigate', { url: recoveryUrl });
  await waitFor(`document.querySelector('input[name=newPassword]')`);
  assert.equal(await evaluate('window.location.hash'), '');
  await evaluate(`document.querySelector('[name=newPassword]').value = 'recovered test password'; document.querySelector('[name=confirmPassword]').value = 'recovered test password'; document.querySelector('form').requestSubmit()`);
  await waitFor(`document.body.innerText.includes('Your password has been updated.')`);
  assert.equal(passwordResets, 1);
  console.log('PASS: all-role profile editing, password confirmation/change, admin recovery link and fragment-token reset');
  for (role of ['learner', 'contributor']) {
    await navigate('/support'); await clickButton('New request');
    await waitFor(`document.querySelector('input[name=subject]')`);
    await evaluate(`document.querySelector('[name=category]').value='suggestion'; document.querySelector('[name=subject]').value='Improve the course search'; document.querySelector('textarea[name=message]').value='Please add more filters.'; document.querySelector('form').requestSubmit()`);
    await waitFor(`document.querySelector('[aria-label="Support conversation"]')?.textContent.includes('Please add more filters.')`);
  }
  role = 'admin'; await navigate('/admin/support');
  await clickButton('Improve the course searchsuggestion · open · Test learner', 'section[aria-label=Requests]');
  await waitFor(`document.querySelector('[aria-label="Support conversation"] textarea')`);
  await evaluate(`document.querySelector('[aria-label="Support conversation"] textarea').value='Thanks, we will review this suggestion.'; document.querySelector('[aria-label="Support conversation"] form').requestSubmit()`);
  await waitFor(`document.querySelector('[aria-label="Support conversation"]').textContent.includes('Thanks, we will review')`);
  await clickButton('Mark resolved');
  await waitFor(`document.querySelector('[aria-label="Support conversation"] header').textContent.includes('resolved')`);
  role = 'learner'; await navigate('/support');
  await evaluate(`document.querySelector('section[aria-label=Requests] li button').click()`);
  await waitFor(`document.querySelector('[aria-label="Support conversation"]')?.textContent.includes('Thanks, we will review')`);
  await screenshot('support-conversation');
  role = 'guest'; await send('Page.navigate', { url: origin + '/login' });
  await waitFor(`document.querySelector('a[href="/forgot-password"]')`);
  assert.equal(await evaluate(`document.querySelectorAll('a[href="/forgot-password"]').length`), 1);
  await evaluate(`document.querySelector('a[href="/forgot-password"]').click()`);
  await waitFor(`document.querySelector('textarea[name=message]')`);
  await evaluate(`document.querySelector('[name=name]').value='Guest'; document.querySelector('[name=email]').value='guest@example.test'; document.querySelector('[name=identifier]').value='guest_username'; document.querySelector('[name=message]').value='I cannot sign in.'; document.querySelector('form').requestSubmit()`);
  await waitFor(`document.querySelector('input[readonly]')`);
  const trackingUrl = await evaluate(`document.querySelector('input[readonly]').value`);
  assert.ok(trackingUrl.includes('#token='));
  await send('Page.navigate', { url: trackingUrl });
  await waitFor(`document.querySelector('[aria-label="Support conversation"]')?.textContent.includes('I cannot sign in.')`);
  await evaluate(`document.querySelector('textarea[name=message]').value='Can you help me recover access?'; document.querySelector('form').requestSubmit()`);
  await waitFor(`document.querySelector('[aria-label="Support conversation"] ol').textContent.includes('Can you help me recover access?')`);
  await screenshot('recovery-support-conversation');
  console.log('PASS: single forgot-password link, recovery form/private tracking/reply, learner/contributor suggestions, admin replies and resolution');
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
