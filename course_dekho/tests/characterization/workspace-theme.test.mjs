import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadWorkspaceSession } from '../../lib/server/auth/workspace-session.ts';
import { UnauthenticatedError } from '../../lib/server/api/errors.ts';

const darkUser = { id: 'dark-user', name: 'Dark User', email: 'dark@example.test', username: 'dark', role: 'learner' };
const lightUser = { ...darkUser, id: 'light-user', username: 'light', role: 'contributor' };
const auth = { async getSessionUser(token) { return token === 'd'.repeat(43) ? darkUser : lightUser; } };
const preferences = { async getDisplayPreference(actor) { return { theme: actor.id === darkUser.id ? 'dark' : 'light' }; } };

test('workspace server render resolves each account and its stored theme together', async () => {
  assert.deepEqual(await loadWorkspaceSession('d'.repeat(43), auth, preferences), { user: darkUser, theme: 'dark' });
  assert.deepEqual(await loadWorkspaceSession('l'.repeat(43), auth, preferences), { user: lightUser, theme: 'light' });
  assert.deepEqual(await loadWorkspaceSession('d'.repeat(43), auth, preferences), { user: darkUser, theme: 'dark' });
});

test('missing, invalid, and expired sessions use public light mode without looking up another account preference', async () => {
  const unexpectedPreference = { getDisplayPreference() { assert.fail('Public pages must not load account preferences'); } };
  for (const token of [undefined, '', 'invalid']) {
    assert.deepEqual(await loadWorkspaceSession(token, { getSessionUser() { assert.fail('Invalid session'); } }, unexpectedPreference), { user: null, theme: 'light' });
  }
  assert.deepEqual(await loadWorkspaceSession('x'.repeat(43), { async getSessionUser() { throw new UnauthenticatedError(); } }, unexpectedPreference), { user: null, theme: 'light' });
});

test('preference failures never silently render the wrong theme', async () => {
  await assert.rejects(loadWorkspaceSession('d'.repeat(43), auth, {
    async getDisplayPreference() { throw new Error('Preference service unavailable'); },
  }), /Preference service unavailable/);
});

test('theme ownership is scoped to the workspace and login waits for the account preference', async () => {
  const source = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
  const context = await source('lib/auth/AuthContext.tsx');
  const layout = await source('app/layout.tsx');
  const shell = await source('components/layout/AppShell.tsx');
  const styles = await source('app/globals.css');
  assert.match(layout, /loadWorkspaceSession/);
  assert.doesNotMatch(layout, /course_dekho_theme|data-theme=/);
  assert.match(context, /await getDisplayPreference\(\);[\s\S]*setSession\(\{ user: nextUser, theme: preference.theme \}\)/);
  assert.match(context, /setSession\(\{ user: null, theme: "light" \}\)/);
  assert.doesNotMatch(context, /document.documentElement|localStorage/);
  assert.match(shell, /data-theme=\{theme\}/);
  assert.doesNotMatch(styles, /html\[data-theme="dark"\]/);
  assert.match(styles, /color-scheme: light/);
  assert.match(styles, /caret-color:#0f172a/);
  assert.match(styles, /caret-color:var\(--field-text\)/);
});

test('dark status palettes and muted light text meet normal-text contrast', async () => {
  const css = await readFile(new URL('../../app/globals.css', import.meta.url), 'utf8');
  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
    return channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  }
  function check(foreground, background, label) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    assert.ok((values[1] + 0.05) / (values[0] + 0.05) >= 4.5, `${label} must meet 4.5:1 contrast`);
  }
  for (const family of ['violet', 'indigo', 'blue', 'sky', 'emerald', 'green', 'amber', 'orange', 'rose', 'red']) {
    const background = css.match(new RegExp(`\\.workspace\\[data-theme="dark"\\] :is\\(\\.bg-${family}-50[^}]+background-color:(#[a-f0-9]{6})`))?.[1];
    const foreground = css.match(new RegExp(`\\.workspace\\[data-theme="dark"\\] :is\\(\\.text-${family}-400[^}]+color:(#[a-f0-9]{6})`))?.[1];
    assert.ok(background && foreground, `${family} needs paired background and text colors`);
    check(foreground, background, family);
    check(foreground, '#111a2b', `${family} link on panel`);
  }
  const muted = css.match(/\.workspace \.text-slate-500 \{ color:(#[a-f0-9]{6})/)?.[1];
  for (const background of ['#ffffff', '#f6f5f0', '#e6eadb', '#edeee8']) check(muted, background, 'light secondary text');
});
