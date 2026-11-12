(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = 'lm_token';
  let token = sessionStorage.getItem(KEY) || '';

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const c of children) node.append(c);
    return node;
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        ...(opts.headers || {}),
      },
    });
    let body = null;
    try { body = await res.json(); } catch (_) { /* no body */ }
    if (res.status === 401) {
      signOut();
      throw new Error('Wrong password.');
    }
    if (!res.ok) throw new Error((body && body.error) || 'Request failed.');
    return body;
  }

  function showApp(on) {
    $('app').hidden = !on;
    $('login').hidden = on;
    $('logout').hidden = !on;
  }

  function signOut() {
    token = '';
    try { sessionStorage.removeItem(KEY); } catch (_) {}
    showApp(false);
  }

  function maskedUrl(slug) {
    return location.origin + '/r/' + slug;
  }

  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = old), 1200);
    } catch (_) {
      window.prompt('Copy this link:', text);
    }
  }

  function renderRows(links) {
    const tbody = $('rows');
    tbody.replaceChildren();
    $('empty').hidden = links.length > 0;

    for (const l of links) {
      const url = maskedUrl(l.slug);

      const copyBtn = el('button', { className: 'secondary small', textContent: 'Copy', type: 'button' });
      copyBtn.addEventListener('click', () => copy(url, copyBtn));

      const toggleBtn = el('button', {
        className: 'secondary small',
        type: 'button',
        textContent: l.is_active ? 'Pause' : 'Resume',
      });
      toggleBtn.addEventListener('click', async () => {
        toggleBtn.disabled = true;
        try {
          await api('/api/links?id=' + encodeURIComponent(l.id), {
            method: 'PATCH',
            body: JSON.stringify({ is_active: !l.is_active }),
          });
          await loadLinks();
        } catch (e) { alert(e.message); toggleBtn.disabled = false; }
      });

      const delBtn = el('button', { className: 'secondary small danger', type: 'button', textContent: 'Delete' });
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete "' + l.campaign_name + '" and all its click data?')) return;
        delBtn.disabled = true;
        try {
          await api('/api/links?id=' + encodeURIComponent(l.id), { method: 'DELETE' });
          await loadLinks();
        } catch (e) { alert(e.message); delBtn.disabled = false; }
      });

      const campaignCell = el('td', {},
        el('div', { textContent: l.campaign_name }),
        el('div', { className: 'dest', textContent: l.destination_url, title: l.destination_url })
      );
      const linkCell = el('td', {},
        el('div', { className: 'link-cell' },
          el('a', { href: url, target: '_blank', rel: 'noopener', textContent: url }),
          copyBtn
        )
      );

      const tr = el('tr', {},
        campaignCell,
        linkCell,
        el('td', { className: 'num', textContent: String(l.clicks) }),
        el('td', { className: 'num', textContent: String(l.conversions) }),
        el('td', { className: 'num', textContent: Number(l.revenue).toFixed(2) }),
        el('td', { className: l.is_active ? 'status-on' : 'status-off', textContent: l.is_active ? 'Active' : 'Paused' }),
        el('td', {}, el('div', { className: 'actions' }, toggleBtn, delBtn))
      );
      tbody.append(tr);
    }
  }

  async function loadLinks() {
    const { links } = await api('/api/links');
    renderRows(links);
  }

  // Login
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-error').hidden = true;
    token = $('token').value;
    try {
      await loadLinks();
      try { sessionStorage.setItem(KEY, token); } catch (_) {}
      $('token').value = '';
      showApp(true);
    } catch (err) {
      token = '';
      $('login-error').textContent = err.message;
      $('login-error').hidden = false;
    }
  });

  $('logout').addEventListener('click', signOut);
  $('refresh').addEventListener('click', () => loadLinks().catch((e) => alert(e.message)));

  // Create link
  $('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const msg = $('create-msg');
    msg.hidden = true;
    btn.disabled = true;
    try {
      const { link } = await api('/api/create', {
        method: 'POST',
        body: JSON.stringify({
          campaign_name: $('campaign').value,
          destination_url: $('destination').value,
          slug: $('slug').value,
        }),
      });
      msg.textContent = 'Created: ' + maskedUrl(link.slug);
      msg.className = 'msg';
      msg.hidden = false;
      e.target.reset();
      await loadLinks();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'error';
      msg.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  // Auto-login if a token is saved for this tab
  if (token) {
    loadLinks().then(() => showApp(true)).catch(() => showApp(false));
  }
})();
