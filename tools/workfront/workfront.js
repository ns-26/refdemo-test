// Import SDK
// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const DEFAULT_SERVICE_URL = 'https://hook.app.workfrontfusion.com/xot9mamgl12su5dteagfw64f6lklf7ge';

const PHASE = { CONFIRM: 'confirm', LOADING: 'loading', RESULT: 'result' };

const app = document.getElementById('wf-app');

/**
 * Fetch the current user's profile from Adobe IMS.
 * @param {string} token - Bearer token
 * @returns {Promise<{displayName: string, email: string}>}
 */
async function fetchUserProfile(token) {
  try {
    const resp = await fetch('https://ims-na1.adobelogin.com/ims/profile/v1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`IMS profile: ${resp.status}`);
    const profile = await resp.json();
    return { displayName: profile.displayName || '', email: profile.email || '' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Workfront] Failed to fetch user profile:', err);
    return { displayName: '', email: '' };
  }
}

/**
 * Fetch external-service-url and external-service-payload from placeholders.
 * @param {object} context - DA SDK context
 * @returns {Promise<{serviceUrl: string, servicePayload: string}>}
 */
async function fetchConfig(context) {
  const org = context.org || '';
  const repo = context.repo || '';
  const origin = `https://main--${repo}--${org}.aem.page`;

  try {
    const resp = await fetch(`${origin}/placeholders.json`);
    if (!resp.ok) throw new Error(`Placeholders: ${resp.status}`);
    const json = await resp.json();

    const lookup = {};
    (json.data || []).forEach((row) => { lookup[row.Key] = row.Text; });

    return {
      serviceUrl: lookup['external-service-url'] || DEFAULT_SERVICE_URL,
      servicePayload: lookup['external-service-payload'] || '',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Workfront] Failed to load placeholders, using defaults:', err);
    return { serviceUrl: DEFAULT_SERVICE_URL, servicePayload: '' };
  }
}

/**
 * POST data to the Workfront Fusion webhook.
 * @param {string} url - Service endpoint
 * @param {object} payload - JSON body
 * @param {string} token - Bearer token
 * @returns {Promise<object>}
 */
async function submitToWorkfront(url, payload, token) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Service error ${resp.status}: ${body}`);
  }
  return resp.json();
}

/**
 * Render the UI for a given phase.
 * @param {string} phase - CONFIRM | LOADING | RESULT
 * @param {object} data - Phase-specific data
 */
function render(phase, data = {}) {
  app.innerHTML = '';

  if (phase === PHASE.CONFIRM) {
    const desc = document.createElement('p');
    desc.className = 'wf-description';
    desc.textContent = 'Create and assign a Workfront task for this page?';

    const info = document.createElement('p');
    info.className = 'wf-page-info';
    info.textContent = data.pagePath || '';

    const btnGroup = document.createElement('div');
    btnGroup.className = 'wf-btn-group';

    const noBtn = document.createElement('button');
    noBtn.className = 'wf-btn wf-btn-secondary';
    noBtn.textContent = 'Cancel';
    noBtn.addEventListener('click', () => { if (data.closeLibrary) data.closeLibrary(); });

    const yesBtn = document.createElement('button');
    yesBtn.className = 'wf-btn wf-btn-primary';
    yesBtn.textContent = 'Assign Task';
    yesBtn.addEventListener('click', () => { if (data.onConfirm) data.onConfirm(); });

    btnGroup.append(noBtn, yesBtn);
    app.append(desc, info, btnGroup);
  }

  if (phase === PHASE.LOADING) {
    const spinner = document.createElement('div');
    spinner.className = 'wf-spinner';

    const text = document.createElement('p');
    text.className = 'wf-loading-text';
    text.textContent = 'Submitting to Workfront…';

    app.append(spinner, text);
  }

  if (phase === PHASE.RESULT) {
    const icon = document.createElement('div');
    icon.className = `wf-result-icon ${data.success ? 'wf-success' : 'wf-failure'}`;
    icon.textContent = data.success ? '✓' : '✕';

    const title = document.createElement('p');
    title.className = `wf-result-title ${data.success ? 'wf-success' : 'wf-failure'}`;
    title.textContent = data.success ? 'Success' : 'Failed';

    const msg = document.createElement('p');
    msg.className = 'wf-result-message';
    msg.textContent = data.message || '';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'wf-btn wf-btn-primary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => { if (data.closeLibrary) data.closeLibrary(); });

    app.append(icon, title, msg, closeBtn);
  }
}

/**
 * Main entry point.
 */
(async function init() {
  const { context, token, actions } = await DA_SDK;
  const pagePath = context.pathname || '';

  const handleConfirm = async () => {
    render(PHASE.LOADING);

    try {
      const [config, profile] = await Promise.all([
        fetchConfig(context),
        fetchUserProfile(token),
      ]);

      let payload;
      if (config.servicePayload) {
        payload = JSON.parse(config.servicePayload);
      } else {
        payload = {
          'user-name': profile.displayName,
          'user-email': profile.email,
          editorLocation: pagePath,
          repo: context.repo || '',
          org: context.org || '',
          timestamp: new Date().toISOString(),
        };
      }

      await submitToWorkfront(config.serviceUrl, payload, token);

      render(PHASE.RESULT, {
        success: true,
        message: 'The Workfront task was created successfully.',
        closeLibrary: actions.closeLibrary,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Workfront] Submission failed:', err);
      render(PHASE.RESULT, {
        success: false,
        message: 'An unexpected error occurred while creating the task.',
        closeLibrary: actions.closeLibrary,
      });
    }
  };

  render(PHASE.CONFIRM, {
    pagePath,
    onConfirm: handleConfirm,
    closeLibrary: actions.closeLibrary,
  });
}());
