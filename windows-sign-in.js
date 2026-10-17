import {firebaseConfig} from './store-config.js';

const button = document.getElementById('google-connect');
const status = document.getElementById('sign-in-status');
const state = {sdk: null, auth: null, busy: false, returned: false};

function readReturnAddress(href) {
  const parameters = new URL(href).searchParams;
  const port = parameters.get('desktopPort');
  const nonce = parameters.get('desktopState');
  if (parameters.getAll('desktopPort').length !== 1 || parameters.getAll('desktopState').length !== 1 ||
      !/^[1-9][0-9]{3,4}$/.test(port || '') || Number(port) < 1024 || Number(port) > 65535 ||
      !/^[a-f0-9]{64}$/.test(nonce || '')) return null;
  // A remote host or arbitrary callback URL can never receive a credential.
  return {url: `http://127.0.0.1:${port}/oauth/google`, nonce};
}

const destination = readReturnAddress(location.href);
function message(text, kind = '') {
  status.textContent = text;
  status.dataset.kind = kind;
}
function render() {
  button.disabled = !destination || !state.auth || state.busy || state.returned;
  button.textContent = state.returned ? 'Returning to Windows…' : state.busy ? 'Connecting Google…' : 'Continue with Google';
}
function errorText(error) {
  const code = String(error?.code || '');
  if (code.includes('popup-closed-by-user')) return 'Google sign-in was canceled. Choose Continue with Google to try again.';
  if (code.includes('popup-blocked')) return 'Allow the Google sign-in popup for this website, then choose Continue with Google.';
  if (code.includes('unauthorized-domain')) return 'Google sign-in is not configured for this website. Please contact Zeno Network.';
  return error?.message || 'Google could not connect. Please try again.';
}

async function connect() {
  if (state.busy || state.returned) return;
  if (!destination || !state.auth) {
    message('Start Continue with Google from the updated Windows app.', 'error');
    return;
  }
  state.busy = true;
  render();
  try {
    const provider = new state.sdk.GoogleAuthProvider();
    provider.setCustomParameters({prompt: 'select_account'});
    message('Choose your Google account. Windows will reconnect automatically.');
    const result = await state.sdk.signInWithPopup(state.auth, provider);
    const user = result.user;
    if (!user || user.uid !== state.auth.currentUser?.uid || !user.emailVerified ||
        !/^[^\s@]+@gmail\.com$/i.test(user.email || '') ||
        !user.providerData.some(item => item.providerId === 'google.com')) {
      throw new Error('Please choose a verified Google Gmail account.');
    }
    const credential = state.sdk.GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.idToken) throw new Error('Google did not return a sign-in credential. Please retry.');
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = destination.url;
    form.target = '_self';
    form.hidden = true;
    form.acceptCharset = 'UTF-8';
    for (const [name, value] of [['state', destination.nonce], ['googleIdToken', credential.idToken]]) {
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = name; input.value = value; form.append(input);
    }
    document.body.append(form);
    message('Returning to Zeno Convert Pro. Your Google profile is being verified.');
    // Return through a top-level form POST instead of a cross-origin fetch.
    // No credential is put in the address bar, URL fragments or persistent storage.
    form.submit();
    state.returned = true;
  } catch (error) {
    message(errorText(error), 'error');
  } finally {
    state.busy = false;
    render();
  }
}

async function initialize() {
  if (!destination) {
    message('Open Zeno Convert Pro 1.2.9 or newer and choose Continue with Google there.', 'error');
    render();
    return;
  }
  try {
    const root = 'https://www.gstatic.com/firebasejs/13.0.0/';
    const [app, auth] = await Promise.all([import(`${root}firebase-app.js`), import(`${root}firebase-auth.js`)]);
    state.sdk = {...app, ...auth};
    // A separate, memory-only Auth instance leaves the website account untouched.
    const firebase = app.initializeApp(firebaseConfig, 'zeno-windows-sign-in');
    state.auth = auth.getAuth(firebase);
    await auth.setPersistence(state.auth, auth.inMemoryPersistence);
    message('Continue with Google to return directly to your Windows app.');
  } catch (error) {
    state.auth = null;
    message(errorText(error), 'error');
  }
  render();
}

button.addEventListener('click', connect);
void initialize();
