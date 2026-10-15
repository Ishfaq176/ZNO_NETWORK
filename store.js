import {firebaseConfig, functionsRegion} from './store-config.js';

const $ = id => document.getElementById(id);
const state = {sdk: null, auth: null, functions: null, user: null, account: null, configuration: null, busy: false, orderNonce: null, authRevision: 0};
const sessionId = new URL(location.href).searchParams.get('desktopSession');
const pairingSession = /^[a-f0-9]{32}$/.test(sessionId || '') ? sessionId : null;
const signInProvider = () => {
  const provider = new state.sdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt: 'select_account'});
  return provider;
};
const message = (text, kind = '') => {
  $('store-message').textContent = text;
  $('store-message').dataset.kind = kind;
};
const errorText = error => {
  const code = String(error?.code || '');
  if (code.includes('popup-closed-by-user')) return 'Google sign-in was canceled. You can try again.';
  if (code.includes('popup-blocked')) return 'Allow the Google sign-in popup for this website, then try again.';
  if (code.includes('unauthorized-domain')) return 'Google sign-in for this website is awaiting owner configuration. Please contact Zeno Network.';
  if (code.includes('functions/not-found')) return 'Windows sign-in and store services are being activated. Please retry later; do not transfer payment yet.';
  if (code.includes('network-request-failed') || code.includes('unavailable') || code.includes('internal')) return 'The secure account service is unavailable. Please retry later; do not transfer payment without an order.';
  return error?.message?.replace(/^Firebase: /, '').replace(/ \(.*\)\.?$/, '') || 'This request could not complete. Please try again.';
};
const call = async (name, data = {}) => {
  const uid = state.user?.uid;
  const response = await state.sdk.httpsCallable(state.functions, name, {timeout: 30000})(data);
  if (name !== 'getStoreConfiguration' && state.user?.uid !== uid) {
    throw new Error('Your Google account changed. Refresh before continuing.');
  }
  return response.data;
};
const element = (tag, content, className) => {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
};
const priceText = amount => `PKR ${Number(amount ?? 9899).toLocaleString('en-PK')}`;
const randomRequestId = () => [...crypto.getRandomValues(new Uint8Array(24))].map(byte => byte.toString(16).padStart(2, '0')).join('');
const createButton = (label, callback, primary = false) => {
  const button = element('button', label, `button button-${primary ? 'primary' : 'secondary'}`);
  button.type = 'button'; button.addEventListener('click', () => action(callback));
  return button;
};

function render() {
  const signedIn = Boolean(state.user && state.account);
  const ready = state.configuration?.ready === true;
  const premium = signedIn && state.account.windows?.premium === true;
  $('new-purchase-price').textContent = priceText(state.configuration?.pricePkr);
  const owner = signedIn && state.account.isAdmin === true;
  $('google-sign-in').hidden = signedIn;
  $('google-sign-in').disabled = !state.auth || state.busy;
  $('google-sign-out').hidden = !state.user;
  $('account-refresh').hidden = !state.user;
  $('google-sign-out').disabled = state.busy;
  $('account-refresh').disabled = state.busy;
  $('account-name').textContent = signedIn ? state.user.displayName || state.user.email : 'Sign in with your Gmail account';
  $('account-detail').textContent = signedIn ? `${state.user.email} · ${owner ? 'Owner / Admin' : premium ? 'Android + Windows Premium active' : 'Premium awaiting purchase or Android restore'}` : 'Use the same Gmail as your Android purchase. One verified purchase unlocks Android and Windows.';
  $('create-order').disabled = !signedIn || !ready || premium || state.busy;
  $('create-order').hidden = premium;
  $('approved-download').hidden = !premium;
  $('download-windows').disabled = state.busy;
  $('checkout-availability').textContent = ready ? 'Already bought Premium on Android? Refresh this same Gmail account before creating another order. New website purchases require verified bank approval.' : 'Website sales are currently closed. Existing Android buyers can sign in and refresh their Premium; do not transfer payment without an order.';
  $('my-orders-panel').hidden = !signedIn;
  $('owner-panel').hidden = !owner;
  $('delete-account-panel').hidden = !signedIn || owner;
  $('desktop-pairing').hidden = !pairingSession;
  $('pairing-code').textContent = pairingSession?.slice(-8).toUpperCase() || '';
  $('pairing-approve').disabled = !signedIn || !$('pairing-confirm').checked || state.busy;
  if (state.configuration) {
    for (const [id, field] of [['bank-name', 'bankName'], ['bank-title-value', 'accountTitle'], ['bank-iban', 'iban'], ['bank-account', 'accountNumber'], ['bank-raast', 'raastId']]) {
      $(id).textContent = state.configuration[field] || 'Not configured';
    }
    $('bank-raast-row').hidden = !state.configuration.raastId;
  }
}

async function action(callback) {
  if (state.busy) return;
  state.busy = true; render();
  const controls = [...document.querySelectorAll('.store-panel input, .store-panel select, .store-panel button')];
  const previous = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  try { await callback(); }
  catch (error) { message(errorText(error), 'error'); }
  finally {
    controls.forEach((control, index) => { if (control.isConnected) control.disabled = previous[index]; });
    state.busy = false; render();
  }
}

function orderCard(order, admin = false) {
  const card = element('article', undefined, 'order-card');
  card.append(element('h4', `Order ${order.id.slice(0, 12).toUpperCase()}`));
  card.append(element('p', `${order.status.replaceAll('_', ' ')} · PKR ${Number(order.pricePkr).toLocaleString('en-PK')}`, 'order-status'));
  if (admin) card.append(element('p', order.email, 'order-meta'));
  if (order.createdAt) card.append(element('p', new Date(order.createdAt).toLocaleString(), 'convert-note'));
  if (order.transactionReference) card.append(element('p', `Customer reference: ${order.transactionReference}`, 'order-meta'));
  if (order.reason) card.append(element('p', `Review note: ${order.reason}`));
  if (!admin && ['awaiting_payment', 'submitted'].includes(order.status)) {
    const form = element('form');
    const label = element('label', 'Actual bank transaction reference');
    const input = element('input'); input.name = 'transactionReference'; input.required = true; input.minLength = 5; input.maxLength = 100;
    input.value = order.transactionReference || ''; input.placeholder = 'Reference from your bank transfer receipt';
    label.append(input); form.append(label);
    const submit = element('button', 'Submit payment for review', 'button button-primary'); submit.type = 'submit'; form.append(submit);
    form.addEventListener('submit', event => {
      event.preventDefault(); const reference = input.value.trim();
      action(async () => {
        await call('submitWindowsPayment', {orderId: order.id, transactionReference: reference});
        await loadOrders(); message('Payment reference submitted. Your license will activate after actual bank credit is verified.', 'success');
      });
    });
    card.append(form);
  }
  if (admin && order.status === 'submitted') {
    const form = element('form');
    const label = element('label', 'Verified bank statement transaction reference');
    const input = element('input'); input.required = true; input.minLength = 5; input.maxLength = 100; label.append(input); form.append(label);
    const checkLabel = element('label', undefined, 'store-check');
    const check = element('input'); check.type = 'checkbox'; check.required = true;
    checkLabel.append(check, document.createTextNode(`I checked my HBL account and confirmed this exact ${priceText(order.pricePkr)} credit.`)); form.append(checkLabel);
    const submit = element('button', 'Approve verified payment & activate license', 'button button-primary'); submit.type = 'submit'; form.append(submit);
    form.addEventListener('submit', event => {
      event.preventDefault(); const bankReference = input.value.trim(); const confirmed = check.checked;
      action(async () => {
        await call('approveWindowsOrder', {orderId: order.id, bankReference, amountReceivedPkr: order.pricePkr, bankCreditConfirmed: confirmed});
        await loadOrders(); message('Verified payment approved. The customer’s Android + Windows lifetime Premium is active.', 'success');
      });
    });
    card.append(form);
  }
  if (admin && ['awaiting_payment', 'submitted'].includes(order.status)) {
    const label = element('label', 'Reason if rejecting this order');
    const reason = element('input'); reason.maxLength = 300; label.append(reason); card.append(label);
    card.append(createButton('Reject order', async () => {
      await call('rejectWindowsOrder', {orderId: order.id, reason: reason.value.trim()});
      await loadOrders(); message('Order rejected with the review note.', 'success');
    }));
  }
  return card;
}

async function loadOrders() {
  if (!state.account) return;
  const uid = state.user?.uid;
  const mine = await call('getMyWindowsOrders');
  if (!uid || state.user?.uid !== uid || !state.account) return;
  $('my-orders').replaceChildren(...(mine.orders.length ? mine.orders.map(order => orderCard(order)) : [element('p', 'No orders yet. Create your Windows order above.')]));
  if (state.account.isAdmin) {
    const all = await call('listWindowsOrders');
    if (state.user?.uid !== uid || !state.account?.isAdmin) return;
    $('owner-orders').replaceChildren(...(all.orders.length ? all.orders.map(order => orderCard(order, true)) : [element('p', 'No customer orders yet.')]));
  }
}

async function loadAccount() {
  const uid = state.user?.uid;
  const account = await call('syncGoogleAccount');
  if (!uid || state.user?.uid !== uid) return;
  state.account = account;
  render();
  await loadOrders();
  if (state.user?.uid !== uid || state.account !== account) return;
  if (state.account.isAdmin) {
    const settings = await call('getWindowsStoreAdmin');
    if (state.user?.uid !== uid || !state.account?.isAdmin) return;
    const form = $('store-settings-form');
    for (const field of ['bankName', 'accountTitle', 'iban', 'accountNumber', 'raastId', 'downloadUrl']) form.elements[field].value = settings[field] || '';
    form.elements.enabled.checked = settings.enabled === true;
  }
}

async function refreshStore() {
  state.configuration = await call('getStoreConfiguration'); render();
}

async function initialize() {
  try {
    const sdkRoot = 'https://www.gstatic.com/firebasejs/13.0.0/';
    const [app, auth, functions] = await Promise.all([import(`${sdkRoot}firebase-app.js`), import(`${sdkRoot}firebase-auth.js`), import(`${sdkRoot}firebase-functions.js`)]);
    state.sdk = {...app, ...auth, ...functions};
    const firebase = app.initializeApp(firebaseConfig);
    state.auth = auth.getAuth(firebase); state.functions = functions.getFunctions(firebase, functionsRegion);
    auth.onAuthStateChanged(state.auth, async user => {
      const revision = ++state.authRevision;
      if (state.user?.uid !== user?.uid) state.orderNonce = null;
      state.user = user; state.account = null;
      $('my-orders').replaceChildren(); $('owner-orders').replaceChildren();
      render();
      if (!user) return;
      try {
        if (!user.emailVerified || !/^[^\s@]+@gmail\.com$/i.test(user.email || '') || !user.providerData.some(provider => provider.providerId === 'google.com')) {
          await auth.signOut(state.auth); throw new Error('Please choose a verified Google Gmail account.');
        }
        await loadAccount();
        if (revision !== state.authRevision) return;
        message('Google account connected. Premium is shared with this same Gmail on Android and Windows.', 'success');
        if (pairingSession) $('pairing-status').textContent = 'Check the matching code before approving this computer.';
      } catch (error) {
        if (revision !== state.authRevision) return;
        state.account = null; render(); message(errorText(error), 'error');
      }
    });
    render();
    await refreshStore();
    if (!state.user) message(state.configuration.ready ? 'Sign in with Google to create a Windows purchase order.' : 'Windows sales are currently closed. Google sign-in and account management remain available.');
  } catch (error) { render(); message(errorText(error), 'error'); }
}

$('google-sign-in').addEventListener('click', () => action(async () => {
  await state.sdk.signInWithPopup(state.auth, signInProvider());
}));
$('google-sign-out').addEventListener('click', () => action(async () => {
  await state.sdk.signOut(state.auth); state.account = null; message('You are signed out.');
}));
$('account-refresh').addEventListener('click', () => action(async () => {
  await refreshStore(); await loadAccount(); message('Account and order status refreshed.', 'success');
}));
$('create-order').addEventListener('click', () => action(async () => {
  state.orderNonce ??= randomRequestId();
  const result = await call('createWindowsOrder', {requestId: state.orderNonce});
  state.orderNonce = null;
  state.configuration = result.receivingAccount; await loadOrders();
  $('my-orders-panel').scrollIntoView({behavior: 'smooth', block: 'start'});
  message(`Order ${result.order.id.slice(0, 12).toUpperCase()} created. Transfer ${priceText(result.order.pricePkr)} to the displayed HBL account, then submit your transaction reference.`, 'success');
}));
$('download-windows').addEventListener('click', () => action(async () => {
  const result = await call('getWindowsDownload');
  const url = new URL(result.url);
  if (url.protocol !== 'https:' || url.username || url.password || !['zenonetwork.xyz', 'www.zenonetwork.xyz', 'github.com', 'storage.googleapis.com', 'firebasestorage.googleapis.com'].includes(url.hostname)) throw new Error('The installer link is not valid. Please contact Zeno Network.');
  location.assign(url.href);
}));
$('copy-iban').addEventListener('click', () => action(async () => {
  await navigator.clipboard.writeText($('bank-iban').textContent); message('HBL IBAN copied.', 'success');
}));
$('pairing-confirm').addEventListener('change', render);
$('pairing-approve').addEventListener('click', () => action(async () => {
  if (!$('pairing-confirm').checked) throw new Error('Check that the code matches your Windows app first.');
  await state.sdk.reauthenticateWithPopup(state.user, signInProvider());
  await state.user.getIdToken(true);
  await call('approveDesktopSignIn', {sessionId: pairingSession});
  $('pairing-status').textContent = 'Computer approved. Return to Zeno Convert Pro; sign-in will finish automatically.';
  $('pairing-confirm').checked = false;
  message('Your computer has been approved. Return to the Windows app.', 'success');
}));
$('store-settings-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); data.enabled = form.elements.enabled.checked;
  action(async () => { state.configuration = await call('updateWindowsStore', data); message('Store settings saved.', 'success'); });
});
$('family-form').addEventListener('submit', event => {
  event.preventDefault(); const values = new FormData(event.currentTarget);
  action(async () => { await call('grantFamilyPremium', {email: values.get('email'), ...(values.get('days') ? {days: Number(values.get('days'))} : {})}); message('Family Premium granted.', 'success'); });
});
$('revoke-family').addEventListener('click', () => action(async () => {
  const form = $('family-form'); if (!form.elements.email.reportValidity()) return;
  await call('revokeFamilyPremium', {email: form.elements.email.value}); message('Family access revoked. Paid purchases stay active.', 'success');
}));
$('owner-orders-refresh').addEventListener('click', () => action(async () => { await loadOrders(); message('Customer orders refreshed.', 'success'); }));
$('delete-account').addEventListener('click', () => action(async () => {
  if (!$('delete-confirm').checked) throw new Error('Read and confirm the account deletion notice first.');
  await state.sdk.reauthenticateWithPopup(state.user, signInProvider()); await state.user.getIdToken(true);
  await call('deleteGoogleAccount'); await state.sdk.signOut(state.auth);
  message('Your Zeno account and active access have been removed. Retained purchase records are described in our privacy policy.', 'success');
}));

void initialize();

