import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

// A minimal DOM for account/checkout state, not a visual browser substitute.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.dataset = {}; this.events = {};
    this.disabled = false; this.hidden = false; this.checked = false; this.isConnected = true;
    this.value = ''; this._text = '';
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent ?? '').join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; this._text = ''; }
  addEventListener(name, callback) { this.events[name] = callback; }
  scrollIntoView() {}
}
function fixture({sessionId} = {}) {
  const html = readFileSync(new URL('../zeno-convert-pro.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const nodes = new Map(ids.map(id => [id, new Element()]));
  assert.equal(nodes.size, ids.length, 'HTML ids must be unique');
  const calls = [];
  let handler = async name => name.endsWith('Orders') ? {orders: []} : {};
  const document = {
    getElementById(id) { assert.ok(nodes.has(id), `Missing HTML target ${id}`); return nodes.get(id); },
    createElement: tag => new Element(tag), createTextNode: text => ({textContent: text}),
    querySelectorAll: () => [],
  };
  const downloads = [];
  const context = vm.createContext({document, URL, location: {href: 'https://zenonetwork.xyz/zeno-convert-pro.html' + (sessionId ? '?desktopSession=' + sessionId : ''), assign: url => downloads.push(url)}, console, crypto: globalThis.crypto});
  let source = readFileSync(new URL('../store.js', import.meta.url), 'utf8');
  assert.ok(source.includes("import {firebaseConfig, functionsRegion} from './store-config.js';"));
  source = source.replace(/^import[^\n]+\n/, 'const firebaseConfig = {}; const functionsRegion = "test";\n')
    .replace('void initialize();', 'globalThis.store = {state, render, loadOrders, orderCard, call};');
  vm.runInContext(source, context);
  const api = context.store;
  api.state.sdk = {httpsCallable: (_functions, name) => async data => {
    calls.push({name, data}); return {data: await handler(name, data)};
  }};
  api.state.auth = {};
  api.state.user = {uid: 'customer', email: 'customer@gmail.com'};
  api.state.account = {windows: {premium: false}, isAdmin: false};
  api.state.configuration = {ready: true, pricePkr: 9899};
  return {...api, nodes, calls, downloads, handle: callback => { handler = callback; }};
}
const descendants = element => [element, ...(element.children ?? []).flatMap(descendants)];

test('a shared Android buyer sees download access and cannot buy Windows twice', () => {
  const f = fixture(); f.state.account.windows.premium = true; f.render();
  assert.equal(f.nodes.get('create-order').hidden, true);
  assert.equal(f.nodes.get('create-order').disabled, true);
  assert.equal(f.nodes.get('approved-download').hidden, false);
  assert.match(f.nodes.get('account-detail').textContent, /Android \+ Windows Premium active/);
});

test('closed sales never permit an unpaid order and the displayed new price is 9,899', () => {
  const f = fixture(); f.state.configuration.ready = false; f.render();
  assert.equal(f.nodes.get('create-order').disabled, true);
  assert.match(f.nodes.get('new-purchase-price').textContent, /9,899/);
  assert.match(f.nodes.get('checkout-availability').textContent, /do not transfer payment/i);
});

test('trial download is available without Google only after the backend publishes a ready link', async () => {
  const f = fixture(); f.state.user = null; f.state.account = null;
  f.render();
  assert.equal(f.nodes.get('download-windows-trial').disabled, true);
  f.state.configuration.trialDownloadUrl = 'https://zenonetwork.xyz/downloads/zeno.zip';
  f.handle(() => f.state.configuration);
  f.render();
  assert.equal(f.nodes.get('download-windows-trial').disabled, false);
  assert.equal(f.nodes.get('create-order').disabled, true);
  await f.nodes.get('download-windows-trial').events.click();
  assert.deepEqual(f.downloads, ['https://zenonetwork.xyz/downloads/zeno.zip']);
  assert.deepEqual(f.calls.map(call => call.name), ['getStoreConfiguration']);
  assert.equal(f.state.account, null);
});

test('closed or unsafe trial links cannot navigate or grant Premium', async () => {
  for (const configuration of [
    {ready: false, trialDownloadUrl: 'https://zenonetwork.xyz/downloads/zeno.zip'},
    {ready: true, trialDownloadUrl: 'javascript:alert(1)'},
    {ready: true, trialDownloadUrl: 'https://evil.example/zeno.zip'},
    {ready: true, trialDownloadUrl: 'https://user:secret@zenonetwork.xyz/zeno.zip'},
  ]) {
    const f = fixture(); f.handle(() => configuration);
    await f.nodes.get('download-windows-trial').events.click();
    assert.equal(f.downloads.length, 0);
    assert.equal(f.state.account.windows.premium, false);
    assert.ok(f.nodes.get('store-message').textContent);
  }
});

test('stale order responses cannot reveal the previous Gmail account after an account change', async () => {
  const f = fixture(); let finish;
  f.handle(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.loadOrders();
  f.state.user = {uid: 'different-account', email: 'other@gmail.com'};
  f.state.account = {windows: {premium: false}, isAdmin: false};
  finish({orders: [{id: 'private-previous-order', pricePkr: 9899}]});
  await assert.rejects(pending, /account changed/i);
  assert.equal(f.nodes.get('my-orders').children.length, 0);
});

test('owner approval confirms the stored order amount, including legacy 9,999 orders', async () => {
  for (const pricePkr of [9899, 9999]) {
    const f = fixture();
    const card = f.orderCard({id: 'a'.repeat(64), pricePkr, status: 'submitted', email: 'customer@gmail.com'}, true);
    const form = descendants(card).find(node => node.tagName === 'form');
    const inputs = descendants(form).filter(node => node.tagName === 'input');
    inputs[0].value = 'VERIFIED-BANK-CREDIT'; inputs[1].checked = true;
    assert.match(form.textContent, new RegExp(pricePkr === 9899 ? '9,899' : '9,999'));
    form.events.submit({preventDefault() {}});
    await new Promise(resolve => setImmediate(resolve));
    const approval = f.calls.find(call => call.name === 'approveWindowsOrder');
    assert.equal(approval.data.amountReceivedPkr, pricePkr);
    assert.equal(approval.data.bankCreditConfirmed, true);
  }
});


test('Windows pairing requires a matching-code confirmation even for the owner', async () => {
  const f = fixture({sessionId: 'a'.repeat(32)});
  f.state.account = {windows: {premium: true}, isAdmin: true};
  f.render();
  assert.equal(f.nodes.get('desktop-pairing').hidden, false);
  assert.equal(f.nodes.get('pairing-approve').disabled, true);
  await f.nodes.get('pairing-approve').events.click();
  assert.equal(f.calls.length, 0);
  assert.match(f.nodes.get('store-message').textContent, /code matches/i);
});

test('a fresh Google connection approves the matching Windows session once', async () => {
  const f = fixture({sessionId: 'b'.repeat(32)});
  f.state.user = null; f.state.account = null;
  const user = {uid: 'google-owner', getIdToken: async () => 'private-token'};
  let popups = 0;
  f.state.sdk.GoogleAuthProvider = class {setCustomParameters() {}};
  f.state.sdk.signInWithPopup = async () => { popups++; f.state.auth.currentUser = user; return {user}; };
  f.state.sdk.reauthenticateWithPopup = async () => { throw new Error('Do not request a second popup after fresh sign-in'); };
  f.nodes.get('pairing-confirm').checked = true;
  f.render();
  assert.equal(f.nodes.get('google-sign-in').hidden, true);
  assert.equal(f.nodes.get('pairing-approve').disabled, false);
  await f.nodes.get('pairing-approve').events.click();
  assert.equal(popups, 1);
  assert.deepEqual(f.calls.map(call => call.name), ['approveDesktopSignIn']);
  assert.equal(f.calls[0].data.sessionId, 'b'.repeat(32));
  assert.equal(f.state.pairingApproved, true);
  assert.equal(f.nodes.get('pairing-approve').disabled, true);
  assert.match(f.nodes.get('pairing-status').textContent, /Computer approved/);
  await f.nodes.get('pairing-approve').events.click();
  assert.equal(f.calls.length, 1);
});

test('an existing owner reauthenticates once and approval survives auth-state refresh', async () => {
  const f = fixture({sessionId: 'c'.repeat(32)});
  const user = {...f.state.user, getIdToken: async () => 'private-token'};
  f.state.auth.currentUser = user;
  f.state.sdk.GoogleAuthProvider = class {setCustomParameters() {}};
  let reauth = 0;
  f.state.sdk.reauthenticateWithPopup = async () => {
    reauth++;
    // Firebase auth observers can refresh the displayed account during reauth.
    f.state.user = null;
    return {user};
  };
  f.nodes.get('pairing-confirm').checked = true;
  await f.nodes.get('pairing-approve').events.click();
  assert.equal(reauth, 1);
  assert.equal(f.state.pairingApproved, true);
  assert.match(f.nodes.get('store-message').textContent, /sent successfully/i);
  assert.equal(f.calls[0].data.sessionId, 'c'.repeat(32));
});

test('failed or canceled Google approval never claims that Windows is connected', async () => {
  const f = fixture({sessionId: 'd'.repeat(32)});
  f.state.sdk.GoogleAuthProvider = class {setCustomParameters() {}};
  f.state.sdk.reauthenticateWithPopup = async () => { throw {code: 'auth/popup-closed-by-user'}; };
  f.nodes.get('pairing-confirm').checked = true;
  await f.nodes.get('pairing-approve').events.click();
  assert.equal(f.state.pairingApproved, false);
  assert.equal(f.calls.length, 0);
  assert.match(f.nodes.get('store-message').textContent, /canceled/i);
});
