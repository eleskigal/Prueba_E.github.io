(() => {
  const shell = document.querySelector('.app-shell');
  const sidebar = document.querySelector('#sidebar');
  const main = document.querySelector('.main');
  if (!shell || !sidebar || !main) return;

  const STORAGE_KEY = 'dcd-sidebar-pinned';
  const isDesktop = () => window.matchMedia('(min-width: 901px)').matches;
  let pinned = localStorage.getItem(STORAGE_KEY) !== 'false';
  let overlayOpen = false;

  const style = document.createElement('style');
  style.textContent = `
    .sidebar{position:sticky}
    .sidebar-controls{display:flex;gap:6px;position:absolute;top:12px;right:10px;z-index:4}
    .sidebar-control{width:30px;height:30px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.78);display:grid;place-items:center;cursor:pointer;transition:background 150ms ease,color 150ms ease,border-color 150ms ease,transform 150ms ease}
    .sidebar-control:hover{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.25)}
    .sidebar-control:focus-visible,.sidebar-reveal:focus-visible{outline:2px solid #d2a856;outline-offset:2px}
    .sidebar-pin svg,.sidebar-hide svg,.sidebar-reveal svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .sidebar-pin.is-pinned{color:#d2a856;background:rgba(210,168,86,.10);border-color:rgba(210,168,86,.28)}
    .sidebar-reveal{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:46;width:36px;height:54px;border:1px solid rgba(255,255,255,.72);border-left:0;border-radius:0 13px 13px 0;background:rgba(255,255,255,.68);color:#163b5c;display:none;place-items:center;cursor:pointer;box-shadow:0 12px 34px rgba(20,45,62,.10),inset 0 1px 0 rgba(255,255,255,.86);backdrop-filter:blur(18px) saturate(120%);-webkit-backdrop-filter:blur(18px) saturate(120%);transition:width 150ms ease,background 150ms ease}
    .sidebar-reveal:hover{width:42px;background:rgba(255,255,255,.88)}
    .sidebar-overlay-backdrop{display:none;position:fixed;inset:0;z-index:39;background:rgba(15,29,40,.13);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
    @media(min-width:901px){
      body.sidebar-collapsed .app-shell{display:block;max-width:none;width:100%;min-height:100vh}
      body.sidebar-collapsed .main{display:block;width:100%;max-width:none;min-width:0;margin:0;padding-left:clamp(28px,3vw,52px);padding-right:clamp(28px,3vw,52px)}
      body.sidebar-collapsed .sidebar{position:fixed!important;left:0;top:0;width:214px;height:100vh;transform:translateX(-104%);transition:transform 210ms cubic-bezier(.2,.8,.2,1),box-shadow 210ms ease;box-shadow:18px 0 52px rgba(11,30,45,.16);z-index:45}
      body.sidebar-collapsed.sidebar-peek .sidebar{transform:translateX(0)}
      body.sidebar-collapsed:not(.sidebar-peek) .sidebar-reveal{display:grid}
      body.sidebar-collapsed.sidebar-peek .sidebar-overlay-backdrop{display:block}
    }
    @media(max-width:900px){.sidebar-controls,.sidebar-reveal,.sidebar-overlay-backdrop{display:none!important}}
  `;
  document.head.appendChild(style);

  const controls = document.createElement('div');
  controls.className = 'sidebar-controls';
  controls.innerHTML = `
    <button class="sidebar-control sidebar-pin" type="button" aria-label="Fijar menú" title="Fijar menú">
      <svg viewBox="0 0 24 24"><path d="M9 4h6l-1 5 3 3H7l3-3-1-5Z"/><path d="M12 12v8"/></svg>
    </button>
    <button class="sidebar-control sidebar-hide" type="button" aria-label="Ocultar menú" title="Ocultar menú">
      <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
    </button>`;
  sidebar.appendChild(controls);

  const reveal = document.createElement('button');
  reveal.className = 'sidebar-reveal';
  reveal.type = 'button';
  reveal.setAttribute('aria-label', 'Desplegar menú');
  reveal.title = 'Desplegar menú';
  reveal.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
  document.body.appendChild(reveal);

  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-overlay-backdrop';
  document.body.appendChild(backdrop);

  const pinButton = controls.querySelector('.sidebar-pin');
  const hideButton = controls.querySelector('.sidebar-hide');

  function sync() {
    if (!isDesktop()) {
      document.body.classList.remove('sidebar-collapsed','sidebar-peek');
      return;
    }
    document.body.classList.toggle('sidebar-collapsed', !pinned);
    document.body.classList.toggle('sidebar-peek', !pinned && overlayOpen);
    pinButton.classList.toggle('is-pinned', pinned);
    pinButton.setAttribute('aria-pressed', String(pinned));
    pinButton.setAttribute('aria-label', pinned ? 'Liberar menú' : 'Fijar menú');
    pinButton.title = pinned ? 'Liberar menú' : 'Fijar menú';
  }

  function setPinned(next) {
    pinned = next;
    overlayOpen = false;
    localStorage.setItem(STORAGE_KEY, String(pinned));
    sync();
  }

  pinButton.addEventListener('click', () => setPinned(!pinned));
  hideButton.addEventListener('click', () => {
    if (pinned) setPinned(false);
    else { overlayOpen = false; sync(); }
  });
  reveal.addEventListener('click', () => { overlayOpen = true; sync(); });
  backdrop.addEventListener('click', () => { overlayOpen = false; sync(); });

  sidebar.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
    if (!pinned && isDesktop()) { overlayOpen = false; sync(); }
  }));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayOpen) { overlayOpen = false; sync(); reveal.focus(); }
  });
  window.addEventListener('resize', sync);
  sync();
})();