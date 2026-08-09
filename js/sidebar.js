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
    .sidebar-controls{display:flex;gap:6px;position:absolute;top:12px;right:10px;z-index:4}
    .sidebar-control{width:30px;height:30px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.78);display:grid;place-items:center;cursor:pointer;transition:background 120ms cubic-bezier(.22,1,.36,1),color 120ms ease,transform 120ms cubic-bezier(.22,1,.36,1)}
    .sidebar-control:hover{background:rgba(255,255,255,.12);color:#fff;transform:translate3d(0,-1px,0)}
    .sidebar-control:focus-visible,.sidebar-reveal:focus-visible{outline:2px solid #d2a856;outline-offset:2px}
    .sidebar-pin svg,.sidebar-hide svg,.sidebar-reveal svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .sidebar-pin.is-pinned{color:#d2a856;background:rgba(210,168,86,.10);border-color:rgba(210,168,86,.28)}
    .sidebar-reveal{position:fixed;left:0;top:50%;transform:translate3d(0,-50%,0);z-index:46;width:36px;height:54px;border:1px solid rgba(255,255,255,.72);border-left:0;border-radius:0 13px 13px 0;background:rgba(255,255,255,.76);color:#163b5c;display:none;place-items:center;cursor:pointer;box-shadow:0 8px 22px rgba(20,45,62,.08);backdrop-filter:blur(10px) saturate(112%);-webkit-backdrop-filter:blur(10px) saturate(112%);transition:transform 120ms cubic-bezier(.22,1,.36,1),background 120ms ease;will-change:transform}
    .sidebar-reveal:hover{transform:translate3d(2px,-50%,0);background:rgba(255,255,255,.88)}
    .sidebar-overlay-backdrop{display:none;position:fixed;inset:0;z-index:39;background:rgba(15,29,40,.10);opacity:0;transition:opacity 160ms ease}
    @media(min-width:901px){
      body.sidebar-collapsed .app-shell{display:block!important;max-width:none!important;width:100%!important;min-height:100vh}
      body.sidebar-collapsed .main{display:block!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding-left:clamp(28px,3vw,52px);padding-right:clamp(28px,3vw,52px)}
      body.sidebar-collapsed .sidebar{position:fixed!important;left:0;top:0;width:214px;height:100vh;transform:translate3d(-104%,0,0);transition:transform 180ms cubic-bezier(.22,1,.36,1);box-shadow:14px 0 34px rgba(11,30,45,.12);z-index:45;will-change:transform;contain:layout paint}
      body.sidebar-collapsed.sidebar-peek .sidebar{transform:translate3d(0,0,0)}
      body.sidebar-collapsed:not(.sidebar-peek) .sidebar-reveal{display:grid}
      body.sidebar-collapsed.sidebar-peek .sidebar-overlay-backdrop{display:block;opacity:1}
    }
    @media(max-width:900px){.sidebar-controls,.sidebar-reveal,.sidebar-overlay-backdrop{display:none!important}}
    @media(prefers-reduced-motion:reduce){.sidebar,.sidebar-control,.sidebar-reveal,.sidebar-overlay-backdrop{transition:none!important}}
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
      document.body.classList.remove('sidebar-collapsed', 'sidebar-peek');
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
    requestAnimationFrame(sync);
  }

  pinButton.addEventListener('click', () => setPinned(!pinned));
  hideButton.addEventListener('click', () => pinned ? setPinned(false) : (overlayOpen = false, requestAnimationFrame(sync)));
  reveal.addEventListener('click', () => { overlayOpen = true; requestAnimationFrame(sync); });
  backdrop.addEventListener('click', () => { overlayOpen = false; requestAnimationFrame(sync); });
  sidebar.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
    if (!pinned && isDesktop()) { overlayOpen = false; requestAnimationFrame(sync); }
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayOpen) { overlayOpen = false; requestAnimationFrame(sync); reveal.focus(); }
  });
  window.addEventListener('resize', sync, { passive: true });
  sync();
})();