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
function fixture() {
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
  const context = vm.createContext({document, URL, location: {href: 'https://zenonetwork.xyz/zeno-convert-pro.html'}, console, crypto: globalThis.crypto});
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
  return {...api, nodes, calls, handle: callback => { handler = callback; }};
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
