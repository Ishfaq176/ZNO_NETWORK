import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const nonce = 'a'.repeat(64);
const validQuery = `?desktopPort=50123&desktopState=${nonce}`;
function fixture(query = validQuery) {
  const forms = [], nodes = new Map();
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.events = {}; this.dataset = {}; this.disabled = false; this.textContent = ''; }
    append(child) { this.children.push(child); }
    addEventListener(name, callback) { this.events[name] = callback; }
    submit() { forms.push(this); }
  }
  const html = readFileSync(new URL('../windows-sign-in.html', import.meta.url), 'utf8');
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, new Element('div'));
  const document = {
    getElementById: id => { assert.ok(nodes.has(id), `Missing ${id}`); return nodes.get(id); },
    createElement: tag => new Element(tag), body: new Element('body'),
  };
  let source = readFileSync(new URL('../windows-sign-in.js', import.meta.url), 'utf8');
  source = source.replace(/^import[^\n]+\n/, 'const firebaseConfig = {};\n')
    .replace('void initialize();', 'globalThis.signIn = {state, connect, render, readReturnAddress};');
  const context = vm.createContext({URL, document, location: {href: 'https://zenonetwork.xyz/windows-sign-in.html' + query}, console});
  vm.runInContext(source, context);
  const api = context.signIn;
  const user = {uid: 'google-user', email: 'user@gmail.com', emailVerified: true, providerData: [{providerId: 'google.com'}]};
  let popup = async () => { api.state.auth.currentUser = user; return {user, credential: {idToken: 'google.payload.signature'}}; };
  api.state.auth = {currentUser: null};
  api.state.sdk = {
    GoogleAuthProvider: class {
      setCustomParameters() {}
      static credentialFromResult(result) { return result.credential; }
    },
    signInWithPopup: (...args) => popup(...args),
  };
  api.render();
  return {...api, html, forms, nodes, user, document, popup: handler => { popup = handler; }};
}

test('direct Windows Google page has no matching-code or approval controls', () => {
  const f = fixture();
  assert.match(f.html, /Continue with Google/);
  assert.doesNotMatch(f.html, /type="checkbox"|pairing-code|pairing-confirm|Approve this computer/);
  assert.match(f.html, /name="referrer" content="origin"/);
  assert.equal(f.nodes.get('google-connect').disabled, false);
});

test('Google login returns once by a POST to this computer without tokens in URLs or Premium claims', async () => {
  const f = fixture();
  await f.connect();
  await f.connect();
  assert.equal(f.forms.length, 1);
  const form = f.forms[0];
  assert.equal(form.method, 'POST');
  assert.equal(form.action, 'http://127.0.0.1:50123/oauth/google');
  assert.equal(form.target, '_self');
  assert.deepEqual(Object.fromEntries(form.children.map(input => [input.name, input.value])), {state: nonce, googleIdToken: 'google.payload.signature'});
  assert.doesNotMatch(form.action, /payload|signature|refreshToken/);
  assert.equal(f.state.returned, true);
  assert.equal(f.nodes.get('google-connect').disabled, true);
});

test('malformed, duplicate, missing or remote callback parameters cannot start Google sign-in', async () => {
  for (const query of ['', '?desktopSession=' + 'b'.repeat(32),
    `?desktopPort=80&desktopState=${nonce}`, `?desktopPort=65536&desktopState=${nonce}`,
    `?desktopPort=050123&desktopState=${nonce}`, `?desktopPort=evil.example&desktopState=${nonce}`,
    '?desktopPort=50123&desktopState=short', `${validQuery}&desktopPort=50124`, `${validQuery}&desktopState=${nonce}`]) {
    const f = fixture(query);
    let popups = 0; f.popup(async () => { popups++; });
    await f.connect();
    assert.equal(popups, 0);
    assert.equal(f.forms.length, 0);
    assert.equal(f.nodes.get('google-connect').disabled, true);
  }
});

test('an arbitrary return URL cannot change the fixed loopback destination', async () => {
  const f = fixture(validQuery + '&returnUrl=https://evil.example/steal');
  await f.connect();
  assert.equal(f.forms[0].action, 'http://127.0.0.1:50123/oauth/google');
});

test('repeated clicks during Google sign-in open only one popup', async () => {
  const f = fixture(); let finish, popups = 0;
  f.popup(() => { popups++; return new Promise(resolve => { finish = resolve; }); });
  const pending = f.connect();
  await f.connect();
  f.state.auth.currentUser = f.user;
  finish({user: f.user, credential: {idToken: 'google.payload.signature'}});
  await pending;
  assert.equal(popups, 1);
  assert.equal(f.forms.length, 1);
});

test('canceled Google sign-in enables retry and sends nothing to Windows', async () => {
  const f = fixture();
  f.popup(async () => { throw {code: 'auth/popup-closed-by-user'}; });
  await f.connect();
  assert.equal(f.forms.length, 0);
  assert.equal(f.state.returned, false);
  assert.equal(f.nodes.get('google-connect').disabled, false);
  assert.match(f.nodes.get('sign-in-status').textContent, /canceled/);
});

test('unverified, non-Gmail, non-Google or switched identities cannot return a credential', async () => {
  for (const change of [user => { user.emailVerified = false; }, user => { user.email = 'user@example.test'; },
    user => { user.providerData = []; }, (_user, f) => { f.state.auth.currentUser = {uid: 'different'}; }]) {
    const f = fixture();
    f.popup(async () => {
      f.state.auth.currentUser = f.user; change(f.user, f);
      return {user: f.user, credential: {idToken: 'google.payload.signature'}};
    });
    await f.connect();
    assert.equal(f.forms.length, 0);
    assert.equal(f.state.returned, false);
    assert.match(f.nodes.get('sign-in-status').textContent, /verified Google Gmail/);
  }
});

test('missing OAuth credentials never report a connected Windows profile', async () => {
  const f = fixture();
  f.popup(async () => { f.state.auth.currentUser = f.user; return {user: f.user}; });
  await f.connect();
  assert.equal(f.forms.length, 0);
  assert.equal(f.state.returned, false);
  assert.match(f.nodes.get('sign-in-status').textContent, /did not return/);
});
