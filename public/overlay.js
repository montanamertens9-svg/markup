(function () {
  var cfg = window.__MARKUP__ || {};
  if (!cfg.reviewId) return;

  var reviewId = cfg.reviewId;
  var pageUrl = cfg.pageUrl || location.href;
  var BASE = '/api/reviews/' + reviewId + '/comments';
  var Z = 2147483600;

  var author = '';
  try { author = localStorage.getItem('markup_author') || ''; } catch (e) {}

  var comments = [];
  var mode = false;

  /* ---------- shadow-isolated UI chrome ---------- */
  var host = document.createElement('div');
  host.id = 'markup-host';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:' + Z + ';';
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  var style = document.createElement('style');
  style.textContent = css();
  root.appendChild(style);

  var ui = document.createElement('div');
  root.appendChild(ui);

  var toggle = mk('button', 'mk-toggle');
  toggle.innerHTML = '<span class="mk-dot"></span><span class="mk-label">Comment</span>';
  ui.appendChild(toggle);
  toggle.addEventListener('click', function () { setMode(!mode); });

  var panel = mk('div', 'mk-panel');
  ui.appendChild(panel);

  var composer = null;
  var popup = null;

  /* pins live in the document so they scroll with content */
  var pinLayer = document.createElement('div');
  pinLayer.id = 'markup-pins';
  pinLayer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:' + (Z - 1) + ';';

  function mount() {
    document.documentElement.appendChild(host);
    (document.body || document.documentElement).appendChild(pinLayer);
    load();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  window.addEventListener('load', render);
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(render, 120); });

  /* ---------- data ---------- */
  function load() {
    fetch(BASE + '?pageUrl=' + encodeURIComponent(pageUrl))
      .then(function (r) { return r.json(); })
      .then(function (d) { comments = Array.isArray(d) ? d : []; render(); })
      .catch(function () {});
  }

  function create(c) {
    return fetch(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(c),
    }).then(function (r) { return r.json(); });
  }

  function patch(id, body) {
    return fetch('/api/comments/' + id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
  }

  function remove(id) {
    return fetch('/api/comments/' + id, { method: 'DELETE' }).then(function (r) { return r.json(); });
  }

  /* ---------- anchoring ---------- */
  function selectorFor(el) {
    if (!el || el.nodeType !== 1 || el === document.body) return 'body';
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      var tag = el.tagName.toLowerCase();
      var p = el.parentNode;
      if (!p || p.nodeType !== 1) { parts.unshift(tag); break; }
      var same = [];
      for (var i = 0; i < p.children.length; i++) {
        if (p.children[i].tagName === el.tagName) same.push(p.children[i]);
      }
      parts.unshift(tag + ':nth-of-type(' + (same.indexOf(el) + 1) + ')');
      el = p;
    }
    return 'body > ' + parts.join(' > ');
  }

  function safeQuery(sel) {
    try { return document.querySelector(sel); } catch (e) { return null; }
  }

  function position(c) {
    var el = c.selector ? safeQuery(c.selector) : null;
    if (el) {
      var r = el.getBoundingClientRect();
      return {
        x: r.left + window.scrollX + c.fx * r.width,
        y: r.top + window.scrollY + c.fy * r.height,
      };
    }
    return { x: c.pageX, y: c.pageY };
  }

  /* ---------- render ---------- */
  function render() {
    pinLayer.innerHTML = '';
    comments.forEach(function (c, i) {
      var pos = position(c);
      var pin = document.createElement('div');
      pin.setAttribute('data-mk', c.id);
      pin.style.cssText =
        'position:absolute;left:' + pos.x + 'px;top:' + pos.y + 'px;' +
        'transform:translate(-4px,-100%);width:28px;height:28px;border-radius:50% 50% 50% 2px;' +
        'background:' + (c.resolved ? '#22c55e' : '#6366f1') + ';color:#fff;' +
        'display:flex;align-items:center;justify-content:center;font:600 13px/1 system-ui;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;pointer-events:auto;' +
        'border:2px solid #fff;';
      pin.textContent = c.resolved ? '✓' : String(i + 1);
      pin.addEventListener('click', function (e) {
        e.stopPropagation();
        openPopup(c, pin);
      });
      pinLayer.appendChild(pin);
    });
    renderPanel();
  }

  function renderPanel() {
    var open = comments.filter(function (c) { return !c.resolved; });
    panel.innerHTML =
      '<div class="mk-head"><b>Comments</b><span class="mk-count">' +
      open.length + ' open · ' + comments.length + ' total</span></div>';
    var list = mk('div', 'mk-list');
    panel.appendChild(list);
    if (!comments.length) {
      var empty = mk('div', 'mk-empty');
      empty.textContent = 'No comments yet. Turn on comment mode and click anywhere on the page.';
      list.appendChild(empty);
    }
    comments.forEach(function (c, i) {
      var item = mk('div', 'mk-item' + (c.resolved ? ' done' : ''));
      item.innerHTML =
        '<div class="mk-num">' + (c.resolved ? '✓' : i + 1) + '</div>' +
        '<div class="mk-body"><div class="mk-meta">' + esc(c.author) + ' · ' + when(c.createdAt) +
        '</div><div class="mk-text">' + esc(c.text) + '</div></div>';
      item.addEventListener('click', function () {
        var pos = position(c);
        window.scrollTo({ top: Math.max(0, pos.y - window.innerHeight / 2), behavior: 'smooth' });
      });
      list.appendChild(item);
    });
  }

  /* ---------- composer ---------- */
  function openComposer(clientX, clientY, draft) {
    closeComposer();
    composer = mk('div', 'mk-card');
    place(composer, clientX, clientY);

    var nameField = '';
    if (!author) {
      nameField = '<input class="mk-name" placeholder="Your name" />';
    }
    composer.innerHTML =
      nameField +
      '<textarea class="mk-ta" placeholder="Leave a comment…"></textarea>' +
      '<div class="mk-row"><button class="mk-cancel">Cancel</button>' +
      '<button class="mk-send">Comment</button></div>';
    ui.appendChild(composer);

    var ta = composer.querySelector('.mk-ta');
    ta.focus();
    var nameInput = composer.querySelector('.mk-name');

    composer.querySelector('.mk-cancel').addEventListener('click', closeComposer);
    composer.querySelector('.mk-send').addEventListener('click', function () {
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      if (nameInput && nameInput.value.trim()) {
        author = nameInput.value.trim();
        try { localStorage.setItem('markup_author', author); } catch (e) {}
      }
      create({
        pageUrl: pageUrl,
        selector: draft.selector,
        fx: draft.fx, fy: draft.fy,
        pageX: draft.pageX, pageY: draft.pageY,
        text: text,
        author: author || 'Anonymous',
      }).then(function () { closeComposer(); load(); });
    });
  }

  function closeComposer() {
    if (composer && composer.parentNode) composer.parentNode.removeChild(composer);
    composer = null;
  }

  /* ---------- popup ---------- */
  function openPopup(c, pin) {
    closePopup();
    var r = pin.getBoundingClientRect();
    popup = mk('div', 'mk-card mk-popup');
    place(popup, r.left + r.width, r.top);
    popup.innerHTML =
      '<div class="mk-meta">' + esc(c.author) + ' · ' + when(c.createdAt) + '</div>' +
      '<div class="mk-ptext">' + esc(c.text) + '</div>' +
      '<div class="mk-row">' +
      '<button class="mk-del">Delete</button>' +
      '<button class="mk-resolve">' + (c.resolved ? 'Reopen' : 'Resolve') + '</button>' +
      '</div>';
    ui.appendChild(popup);
    popup.querySelector('.mk-resolve').addEventListener('click', function () {
      patch(c.id, { resolved: !c.resolved }).then(function () { closePopup(); load(); });
    });
    popup.querySelector('.mk-del').addEventListener('click', function () {
      remove(c.id).then(function () { closePopup(); load(); });
    });
  }

  function closePopup() {
    if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
    popup = null;
  }

  /* keep cards inside the viewport */
  function place(node, x, y) {
    node.style.left = Math.min(x, window.innerWidth - 280) + 'px';
    node.style.top = Math.min(y, window.innerHeight - 180) + 'px';
  }

  /* ---------- mode + click capture ---------- */
  function setMode(on) {
    mode = on;
    document.body.classList.toggle('markup-comment-mode', on);
    toggle.classList.toggle('on', on);
    if (!on) closeComposer();
  }

  document.addEventListener(
    'click',
    function (e) {
      if (!mode) return;
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(host) >= 0 || path.indexOf(pinLayer) >= 0) return;
      e.preventDefault();
      e.stopPropagation();
      var el = document.elementFromPoint(e.clientX, e.clientY) || document.body;
      var r = el.getBoundingClientRect();
      openComposer(e.clientX, e.clientY, {
        selector: selectorFor(el),
        fx: r.width ? (e.clientX - r.left) / r.width : 0,
        fy: r.height ? (e.clientY - r.top) / r.height : 0,
        pageX: e.pageX,
        pageY: e.pageY,
      });
    },
    true
  );

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeComposer(); closePopup(); }
  });

  /* ---------- helpers ---------- */
  function mk(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function when(t) {
    var d = (Date.now() - t) / 1000;
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }

  function css() {
    return [
      '.mk-toggle{position:fixed;right:20px;bottom:20px;display:flex;align-items:center;gap:8px;',
      'padding:11px 16px;border:none;border-radius:30px;background:#111827;color:#fff;',
      'font:600 14px system-ui;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.3);}',
      '.mk-toggle.on{background:#6366f1;}',
      '.mk-dot{width:9px;height:9px;border-radius:50%;background:#6366f1;}',
      '.mk-toggle.on .mk-dot{background:#fff;}',
      '.mk-panel{position:fixed;right:20px;bottom:74px;width:300px;max-height:60vh;overflow:auto;',
      'background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.25);',
      'font:13px system-ui;color:#111;}',
      '.mk-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;',
      'border-bottom:1px solid #eee;position:sticky;top:0;background:#fff;}',
      '.mk-count{color:#888;font-size:11px;}',
      '.mk-list{padding:4px;}',
      '.mk-empty{padding:20px 14px;color:#999;line-height:1.5;}',
      '.mk-item{display:flex;gap:10px;padding:10px;border-radius:8px;cursor:pointer;}',
      '.mk-item:hover{background:#f5f5f7;}',
      '.mk-item.done{opacity:.55;}',
      '.mk-num{flex:none;width:22px;height:22px;border-radius:50%;background:#6366f1;color:#fff;',
      'display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;}',
      '.mk-item.done .mk-num{background:#22c55e;}',
      '.mk-meta{color:#888;font-size:11px;margin-bottom:3px;}',
      '.mk-text{line-height:1.45;white-space:pre-wrap;word-break:break-word;}',
      '.mk-card{position:fixed;width:260px;background:#fff;border-radius:12px;padding:12px;',
      'box-shadow:0 10px 40px rgba(0,0,0,.3);font:13px system-ui;color:#111;}',
      '.mk-card .mk-name,.mk-card .mk-ta{width:100%;border:1px solid #ddd;border-radius:8px;',
      'padding:8px;font:13px system-ui;margin-bottom:8px;resize:vertical;}',
      '.mk-card .mk-ta{min-height:70px;}',
      '.mk-row{display:flex;justify-content:flex-end;gap:8px;}',
      '.mk-row button{padding:7px 14px;border-radius:8px;border:none;font:600 13px system-ui;cursor:pointer;}',
      '.mk-cancel,.mk-del{background:#eee;color:#333;}',
      '.mk-send,.mk-resolve{background:#6366f1;color:#fff;}',
      '.mk-ptext{line-height:1.45;white-space:pre-wrap;word-break:break-word;margin:6px 0 10px;}',
    ].join('');
  }
})();
