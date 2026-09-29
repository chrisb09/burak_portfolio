// <car-net>: an interactive 3D wireframe of the AMG GT3, with a fictional
// ECU/bus network overlaid on top to illustrate vehicle networking.
// Loads three.js from a CDN at runtime, so no bundler is needed.
(() => {
  const THREE_URL = 'https://esm.sh/three@0.184.0';
  const ORBIT_URL = 'https://esm.sh/three@0.184.0/examples/jsm/controls/OrbitControls.js';
  const GLTF_URL = 'https://esm.sh/three@0.184.0/examples/jsm/loaders/GLTFLoader.js';

  const TOKENS = {
    body: ['--color-accent', '#9184d9'],
    shell: ['--color-bg', '#161826'],
    grid: ['--color-neutral-800', '#3f424d'],
    can: ['--color-signal', '#39ff8f'],
    flexray: ['--color-accent', '#9184d9'],
    eth: ['--color-neutral-200', '#e4e7f5'],
    text: ['--color-neutral-400', '#b2b6ca']
  };

  // resolve design-system custom properties to values three.js can parse
  function palette() {
    const cs = getComputedStyle(document.documentElement);
    const probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const out = {};
    for (const k in TOKENS) {
      const [name, fallback] = TOKENS[k];
      let v = (cs.getPropertyValue(name) || '').trim() || fallback;
      if (!/^#|^rgb/.test(v)) {
        probe.style.color = '';
        probe.style.color = v;
        v = getComputedStyle(probe).color || fallback;
      }
      out[k] = v;
    }
    probe.remove();
    return out;
  }
  const PALETTE = { body: '#9184d9', shell: '#161826', grid: '#3f424d', can: '#39ff8f', flexray: '#9184d9', eth: '#e4e7f5', text: '#b2b6ca' };

  // fictional layout, fractions of the vehicle bounding box
  // fx: -0.5 rear .. +0.5 front · fy: 0 floor .. 1 roof · fz: lateral
  const ECUS = [
    { id: 'gw', label: 'GW', name: 'Gateway', nameEn: 'Gateway', bus: 'can', fx: -0.06, fy: 0.36, fz: 0.0, hub: true },
    { id: 'pt', label: 'PT', name: 'Antrieb', nameEn: 'Powertrain', bus: 'can', fx: 0.33, fy: 0.34, fz: -0.18, via: [0.18, 0.3, -0.1] },
    { id: 'ch', label: 'CH', name: 'Fahrwerk', nameEn: 'Chassis', bus: 'flexray', fx: -0.3, fy: 0.24, fz: 0.2, via: [-0.12, 0.26, 0.14] },
    { id: 'iv', label: 'IV', name: 'Infotainment', nameEn: 'Infotainment', bus: 'eth', fx: 0.2, fy: 0.66, fz: 0.28, via: [0.06, 0.5, 0.18] },
    { id: 'bd', label: 'BD', name: 'Karosserie', nameEn: 'Body', bus: 'can', fx: -0.38, fy: 0.42, fz: -0.16, via: [-0.2, 0.44, -0.1] },
    { id: 'fs', label: 'FS', name: 'Frontsensorik', nameEn: 'Front Sensors', bus: 'flexray', fx: 0.45, fy: 0.3, fz: 0.02, via: [0.4, 0.3, -0.1] }
  ];

  const LAYERS = [
    { id: 'body', label: 'Karosserie', labelEn: 'Body', color: PALETTE.body },
    { id: 'can', label: 'CAN / CAN FD', labelEn: 'CAN / CAN FD', color: PALETTE.can },
    { id: 'flexray', label: 'FlexRay', labelEn: 'FlexRay', color: PALETTE.flexray },
    { id: 'eth', label: 'Automotive Ethernet', labelEn: 'Automotive Ethernet', color: PALETTE.eth }
  ];

  const STRINGS = {
    hintDrag: { de: 'Ziehen zum <em>Drehen</em>', en: 'Drag to <em>rotate</em>' },
    hintScroll: { de: 'Scrollen zum <em>Zoomen</em>', en: 'Scroll to <em>zoom</em>' },
    noteTitle: { de: 'Beispielhafte Darstellung', en: 'Example illustration' },
    noteSub: { de: 'Keine reale Vernetzung oder Steuergeräte', en: 'Not an actual network or real ECUs' },
    loading: { de: 'Modell wird geladen', en: 'Loading model' },
    missTitle: { de: 'Fahrzeugmodell fehlt noch', en: 'Vehicle model not added yet' },
    missBody: {
      de: 'Die GLB-Datei liegt noch nicht im Projekt (Upload-Limit 30&nbsp;MB).<br>Komprimiert unter <code>assets/amg-gt3.glb</code> ablegen &mdash; dann erscheint der Umriss hier.',
      en: 'The GLB file isn&rsquo;t in the project yet (30&nbsp;MB upload limit).<br>Drop a compressed version at <code>assets/amg-gt3.glb</code> &mdash; the outline will then appear here.'
    },
    // required attribution for the underlying 3D model (CC BY 4.0) — see
    // https://sketchfab.com/3d-models/mercedes-benz-amg-gt3-red-bull-83c34fe5c0d64d838bc3c5e0f2d7f56a
    modelCredit: {
      de: '3D-Modell &bdquo;Mercedes-AMG GT3 Red&nbsp;Bull&ldquo; von <a href="https://sketchfab.com/3d-models/mercedes-benz-amg-gt3-red-bull-83c34fe5c0d64d838bc3c5e0f2d7f56a" target="_blank" rel="noopener">toddeppe</a> (Basis: Vecarz), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC&nbsp;BY&nbsp;4.0</a>',
      en: '3D model &ldquo;Mercedes-AMG GT3 Red&nbsp;Bull&rdquo; by <a href="https://sketchfab.com/3d-models/mercedes-benz-amg-gt3-red-bull-83c34fe5c0d64d838bc3c5e0f2d7f56a" target="_blank" rel="noopener">toddeppe</a> (based on Vecarz), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC&nbsp;BY&nbsp;4.0</a>'
    }
  };

  class CarNet extends HTMLElement {
    connectedCallback() {
      if (this._up) return;
      this._up = true;
      this._lang = this._lang || 'de';
      this.style.display = 'block';
      this.style.position = this.style.position || 'relative';
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; position:relative; }
          .wrap { position:absolute; inset:0; overflow:hidden; }
          canvas { display:block; width:100%; height:100%; touch-action:none; cursor:grab; }
          canvas:active { cursor:grabbing; }
          .labels { position:absolute; inset:0; pointer-events:none; }
          .lb { position:absolute; transform:translate(10px,-50%); white-space:nowrap;
                font-family:Sora,system-ui,sans-serif; font-size:10.5px; letter-spacing:0.1em;
                text-transform:uppercase; color:var(--color-neutral-400, #b2b6ca); opacity:0; transition:opacity .18s; }
          .lb b { color:var(--color-text, #e9e9ed); font-weight:500; letter-spacing:0.04em; text-transform:none; }
          .lb.left { transform:translate(calc(-100% - 10px), -50%); text-align:right; }
          .chips { position:absolute; left:0; right:0; bottom:0; display:flex; flex-wrap:wrap;
                   gap:8px; padding:14px 16px; }
          button { display:inline-flex; align-items:center; gap:7px; padding:5px 11px 5px 9px;
                   border-radius:999px; border:1px solid var(--color-neutral-800, #3f424d);
                   background:color-mix(in oklab, var(--color-bg, #161826) 72%, transparent);
                   backdrop-filter:blur(6px); color:var(--color-neutral-400, #b2b6ca); font-family:Sora,system-ui,sans-serif;
                   font-size:10.5px; letter-spacing:0.11em; text-transform:uppercase; cursor:pointer;
                   transition:color .18s, border-color .18s, opacity .18s; }
          button[aria-pressed="false"] { opacity:.42; }
          button:hover { color:var(--color-text, #e9e9ed); border-color:var(--color-neutral-700, #595d6c); }
          .sw { width:16px; height:2px; border-radius:2px; }
          /* attribution line for the underlying 3D model — lives in the
             same flex-wrap chips row as the layer toggles so it wraps
             onto its own line on narrow boxes instead of overlapping
             anything, rather than being separately positioned. */
          .credit { display:inline-flex; align-items:center; padding:5px 2px;
                    font-size:9px; letter-spacing:0.01em; text-transform:none;
                    color:var(--color-neutral-600, #75798c); pointer-events:auto; }
          .credit a { color:inherit; text-decoration:underline;
                      text-decoration-color:color-mix(in oklab, var(--color-neutral-600, #75798c) 55%, transparent); }
          .credit a:hover { color:var(--color-neutral-300, #cfd3e5); }
          .note { position:absolute; top:13px; right:15px; display:flex; flex-direction:column;
                  align-items:flex-end; gap:4px; padding:8px 14px 9px; border-radius:14px;
                  border:1px solid color-mix(in oklab, #ff2d46 46%, transparent);
                  background:color-mix(in oklab, var(--color-bg, #161826) 78%, transparent);
                  backdrop-filter:blur(6px); font-family:Sora,system-ui,sans-serif;
                  pointer-events:none; max-width:calc(100% - 30px); text-align:right; }
          .note .row { display:flex; align-items:center; gap:8px; line-height:1; }
          .note b { flex-shrink:0; width:14px; height:14px; border-radius:50%; font-size:10px;
                    font-weight:700; display:flex; align-items:center; justify-content:center;
                    color:#ff2d46; font-style:normal; padding-top:1px; box-sizing:border-box;
                    border:1px solid color-mix(in oklab, #ff2d46 70%, transparent);
                    box-shadow:0 0 8px 1px color-mix(in oklab, #ff2d46 28%, transparent); }
          .note i { font-style:normal; font-size:9.5px; letter-spacing:0.16em; color:#ff2d46;
                    text-transform:uppercase; line-height:1; }
          .note s { text-decoration:none; font-size:9.5px; letter-spacing:0.02em; line-height:1.5;
                    color:#ff8f9c; }
          .hint { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
                  display:flex; flex-direction:column; align-items:center; gap:7px; padding:12px 18px; border-radius:14px;
                  border:1px solid var(--color-neutral-800, #3f424d);
                  background:color-mix(in oklab, var(--color-bg, #161826) 76%, transparent);
                  backdrop-filter:blur(6px); font-family:Sora,system-ui,sans-serif; font-size:10px;
                  letter-spacing:0.14em; text-transform:uppercase; pointer-events:none; white-space:nowrap;
                  color:var(--color-neutral-400, #b2b6ca); opacity:0;
                  transition:opacity .45s ease, transform .45s cubic-bezier(0.22,0.7,0.3,1); }
          .hint[data-on] { opacity:1; }
          .hint[data-off] { opacity:0; transform:translate(-50%, calc(-50% + 10px)); }
          .hint em { font-style:normal; font-weight:600; letter-spacing:0.1em;
                     background:var(--color-text, #e9e9ed); color:var(--color-bg, #161826);
                     padding:2px 6px 3px; border-radius:4px; margin-left:2px; }
          .miss { position:absolute; left:50%; bottom:52px; transform:translateX(-50%);
                  display:flex; flex-direction:column; align-items:center; gap:5px; text-align:center;
                  padding:12px 18px; max-width:min(90%,420px); pointer-events:none;
                  border:1px dashed var(--color-neutral-800, #3f424d); border-radius:10px;
                  background:color-mix(in oklab, var(--color-bg, #161826) 72%, transparent);
                  font-family:Sora,system-ui,sans-serif; color:var(--color-neutral-600, #75798c);
                  font-size:11.5px; line-height:1.6; }
          .load { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
                  display:flex; align-items:center; gap:9px; padding:9px 15px; border-radius:999px;
                  border:1px solid var(--color-neutral-800, #3f424d);
                  background:color-mix(in oklab, var(--color-bg, #161826) 76%, transparent);
                  backdrop-filter:blur(6px); font-family:Sora,system-ui,sans-serif; font-size:10px;
                  letter-spacing:0.14em; text-transform:uppercase; pointer-events:none;
                  color:var(--color-neutral-400, #b2b6ca); transition:opacity .35s; }
          .load .sp { width:12px; height:12px; border-radius:50%; flex-shrink:0;
                      border:1.5px solid color-mix(in oklab, #39ff8f 28%, transparent);
                      border-top-color:#39ff8f; animation:spin 0.85s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
          .miss strong { color:var(--color-neutral-400, #b2b6ca); font-weight:500; font-size:13px; letter-spacing:0.02em; }
          .miss code { color:var(--color-accent, #9184d9); font-size:11.5px; }

          /* On a short mobile-width box the warning badge, the drag/zoom
             hint and the layer chips can all be on screen at once and
             start to overlap. Shrink them and move the hint down so it
             sits between the badge and the chips instead of behind them. */
          @media (max-width: 480px) {
            .note { top:9px; right:9px; padding:6px 10px 7px; max-width:calc(100% - 18px); }
            .note i, .note s { font-size:8.5px; }
            .hint { top:62%; padding:9px 14px; font-size:9px; }
            .chips { padding:10px 12px; gap:6px; }
            button { padding:4px 9px 4px 7px; font-size:9.5px; }
          }
        </style>
        <div class="wrap">
          <div class="labels"></div>
          <div class="hint"><span data-s="hintDrag">Ziehen zum <em>Drehen</em></span><span data-s="hintScroll">Scrollen zum <em>Zoomen</em></span></div>
          <div class="note"><span class="row"><b>!</b><i data-s="noteTitle">Beispielhafte Darstellung</i></span><s data-s="noteSub">Keine reale Vernetzung oder Steuergeräte</s></div>
          <div class="load"><span class="sp"></span><span data-s="loading">Modell wird geladen</span></div>
          <div class="chips"></div>
        </div>`;
      this._boot();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      this._ro && this._ro.disconnect();
    }

    setLang(lang) {
      this._lang = lang;
      this._applyLang();
    }

    setTheme(theme) {
      this._theme = theme;
      // Shadow-DOM labels/chips use CSS vars and flip automatically.
      // Three.js materials use the parsed palette — refresh from computed vars.
      try {
        Object.assign(PALETTE, palette());
        const light = theme === 'light';
        // keep chip swatches in sync (LAYERS colors are a boot-time snapshot)
        (this._layersRef || []).forEach((l) => {
          const c = PALETTE[l.id] || l.color;
          l.color = c;
          if (l._chipSw) l._chipSw.style.background = c;
        });
        if (this._mats) {
          if (this._mats.grid) {
            this._mats.grid.color.set(PALETTE.grid);
            this._mats.grid.opacity = light ? 0.4 : 0.13;
          }
          if (this._mats.edge) {
            this._mats.edge.color.set(PALETTE.body);
            this._mats.edge.opacity = light ? 0.85 : 0.5;
          }
          if (this._mats.shell) {
            this._mats.shell.color.set(PALETTE.shell);
            // light fill on a light background washes the wireframe out —
            // nearly transparent in light mode, solid in dark mode.
            this._mats.shell.opacity = light ? 0.15 : 0.66;
          }
          if (this._mats.bus) {
            for (const bus of Object.keys(this._mats.bus)) {
              const col = PALETTE[bus];
              if (!col) continue;
              this._mats.bus[bus].forEach((m) => {
                m.color.set(col);
                if (m.userData && m.userData.lightOpacity !== undefined && m.userData.darkOpacity !== undefined) {
                  m.opacity = light ? m.userData.lightOpacity : m.userData.darkOpacity;
                }
              });
            }
          }
        }
      } catch (e) {}
    }

    _applyLang() {
      const root = this.shadowRoot;
      if (!root) return;
      const en = this._lang === 'en';
      root.querySelectorAll('[data-s]').forEach((el) => {
        const s = STRINGS[el.dataset.s];
        if (s) el.innerHTML = en ? s.en : s.de;
      });
      (this._ecusRef || []).forEach((e) => {
        if (e._labelB) e._labelB.textContent = en ? e.nameEn : e.name;
      });
      (this._layersRef || []).forEach((l) => {
        if (l._chipLbl) l._chipLbl.textContent = en ? l.labelEn : l.label;
      });
    }

    async _boot() {
      const [THREE, { OrbitControls }, { GLTFLoader }] = await Promise.all([
        import(THREE_URL), import(ORBIT_URL), import(GLTF_URL)
      ]);
      Object.assign(PALETTE, palette());
      const bootLight = (this._theme || document.documentElement.getAttribute('data-theme')) === 'light';
      // LAYERS colors are a module-load snapshot (dark defaults) — refresh
      // from the resolved palette so chips match the active theme on first paint.
      LAYERS.forEach((l) => {
        if (PALETTE[l.id]) l.color = PALETTE[l.id];
      });
      const wrap = this.shadowRoot.querySelector('.wrap');
      const labelHost = this.shadowRoot.querySelector('.labels');

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      wrap.insertBefore(renderer.domElement, labelHost);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
      camera.position.set(-4.1, 1.95, 4.2);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.enablePan = false;
      controls.minDistance = 2.9;
      controls.maxDistance = 13;
      controls.maxPolarAngle = Math.PI * 0.495;
      controls.target.set(0, 0.5, 0);
      controls.addEventListener('start', () => {
        const h = this.shadowRoot.querySelector('.hint');
        if (h) { h.removeAttribute('data-on'); h.setAttribute('data-off', ''); setTimeout(() => h.remove(), 500); }
      });

      const grid = new THREE.GridHelper(14, 28, PALETTE.grid, PALETTE.grid);
      grid.material.transparent = true;
      grid.material.opacity = bootLight ? 0.4 : 0.13;
      grid.material.depthWrite = false;
      scene.add(grid);
      this._mats = this._mats || {};
      this._mats.grid = grid.material;
      this._mats.bus = { can: [], flexray: [], eth: [] };

      const groups = {};
      LAYERS.forEach(l => {
        groups[l.id] = new THREE.Group();
        groups[l.id].name = l.id;
        groups[l.id].renderOrder = l.id === 'body' ? 0 : 3;
        scene.add(groups[l.id]);
      });
      const xray = m => { m.depthTest = false; m.depthWrite = false; return m; };

      // --- vehicle outlines -------------------------------------------------
      const LENGTH = 4.6;
      let box = new THREE.Box3(new THREE.Vector3(-LENGTH / 2, 0, -1.0), new THREE.Vector3(LENGTH / 2, 1.25, 1.0));

      try {
        const gltf = await new GLTFLoader().loadAsync('./assets/amg-gt3.glb');
        const model = gltf.scene;

        // orient: longest extent -> X, smallest -> Y
        let b = new THREE.Box3().setFromObject(model);
        const size = b.getSize(new THREE.Vector3());
        const ax = [
          { k: 'x', v: size.x, u: new THREE.Vector3(1, 0, 0) },
          { k: 'y', v: size.y, u: new THREE.Vector3(0, 1, 0) },
          { k: 'z', v: size.z, u: new THREE.Vector3(0, 0, 1) }
        ].sort((a, c) => c.v - a.v);
        const xAxis = ax[0].u.clone();              // longest -> length
        const yAxis = ax[2].u.clone();              // shortest -> height
        const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
        if (zAxis.lengthSq() < 0.5) zAxis.copy(ax[1].u);
        const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
        if (basis.determinant() < 0) zAxis.negate();
        const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).invert();
        model.applyMatrix4(m);
        model.updateMatrixWorld(true);

        b = new THREE.Box3().setFromObject(model);
        const s = LENGTH / b.getSize(new THREE.Vector3()).x;
        model.scale.multiplyScalar(s);
        model.updateMatrixWorld(true);
        b = new THREE.Box3().setFromObject(model);
        const c = b.getCenter(new THREE.Vector3());
        model.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
        model.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(model);

        const edgeMat = new THREE.LineBasicMaterial({
          color: PALETTE.body, transparent: true, opacity: bootLight ? 0.85 : 0.5, depthWrite: false
        });
        const shellMat = new THREE.MeshBasicMaterial({
          color: PALETTE.shell, transparent: true, opacity: bootLight ? 0.15 : 0.66,
          polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
        });
        this._mats.edge = edgeMat;
        this._mats.shell = shellMat;
        model.updateMatrixWorld(true);
        model.traverse(o => {
          if (!o.isMesh || !o.geometry) return;
          const g = o.geometry.index ? o.geometry : o.geometry.clone();
          const shell = new THREE.Mesh(g, shellMat);
          shell.name = 'shell';
          shell.applyMatrix4(o.matrixWorld);
          groups.body.add(shell);
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 24), edgeMat);
          e.name = 'edges';
          e.applyMatrix4(o.matrixWorld);
          groups.body.add(e);
        });
      } catch (err) {
        const d = document.createElement('div');
        d.className = 'miss';
        d.innerHTML = `<strong data-s="missTitle">Fahrzeugmodell fehlt noch</strong>
          <span data-s="missBody">Die GLB-Datei liegt noch nicht im Projekt (Upload-Limit 30&nbsp;MB).<br>
          Komprimiert unter <code>assets/amg-gt3.glb</code> ablegen &mdash; dann erscheint der Umriss hier.</span>`;
        this.shadowRoot.querySelector('.wrap').appendChild(d);
        this._miss = d;
      }

      const load = this.shadowRoot.querySelector('.load');
      if (load) { load.style.opacity = '0'; setTimeout(() => load.remove(), 400); }
      const hintEl = this.shadowRoot.querySelector('.hint');
      if (hintEl) setTimeout(() => hintEl.setAttribute('data-on', ''), 420);

      // --- ECU network ------------------------------------------------------
      const sz = box.getSize(new THREE.Vector3());
      const ctr = box.getCenter(new THREE.Vector3());
      const P = (fx, fy, fz) => new THREE.Vector3(
        ctr.x + fx * sz.x, box.min.y + fy * sz.y, ctr.z + fz * sz.z
      );

      const hub = ECUS.find(e => e.hub);
      const hubPos = P(hub.fx, hub.fy, hub.fz);
      const pulses = [];
      const labels = [];

      ECUS.forEach((e, i) => {
        const g = groups[e.bus];
        const pos = P(e.fx, e.fy, e.fz);
        const col = PALETTE[e.bus];

        const nodeMat = xray(new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
        nodeMat.userData.darkOpacity = 0.9;
        nodeMat.userData.lightOpacity = 0.95;
        this._mats.bus[e.bus].push(nodeMat);
        const r = e.hub ? 0.105 : 0.075;
        const node = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.OctahedronGeometry(r, 0)), nodeMat
        );
        node.name = 'ecu-' + e.id;
        node.position.copy(pos);
        g.add(node);

        const core = new THREE.Mesh(
          new THREE.SphereGeometry(r * 0.42, 12, 8),
          xray(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 }))
        );
        core.material.userData.darkOpacity = 0.9;
        core.material.userData.lightOpacity = 0.95;
        this._mats.bus[e.bus].push(core.material);
        core.renderOrder = 4;
        core.position.copy(pos);
        g.add(core);
        e._core = core;
        e._node = node;

        if (!e.hub) {
          const via = P(e.via[0], e.via[1], e.via[2]);
          const curve = new THREE.CatmullRomCurve3([hubPos.clone(), via, pos.clone()], false, 'catmullrom', 0.4);
          const lineMat = xray(new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: bootLight ? 0.75 : 0.45 }));
          lineMat.userData.darkOpacity = 0.45;
          lineMat.userData.lightOpacity = 0.75;
          this._mats.bus[e.bus].push(lineMat);
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
            lineMat
          );
          line.name = 'bus-' + e.id;
          g.add(line);

          const pMat = xray(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 }));
          pMat.userData.darkOpacity = 0.95;
          pMat.userData.lightOpacity = 0.95;
          this._mats.bus[e.bus].push(pMat);
          const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.028, 10, 8),
            pMat
          );
          p.name = 'pulse-' + e.id;
          p.renderOrder = 5;
          g.add(p);
          pulses.push({ mesh: p, curve, offset: i * 0.17, speed: 0.2 + (i % 3) * 0.035 });
        }

        const el = document.createElement('div');
        el.className = 'lb';
        el.innerHTML = `<b>${this._lang === 'en' ? e.nameEn : e.name}</b>`;
        labelHost.appendChild(el);
        e._labelB = el.querySelector('b');
        labels.push({ el, pos, layer: e.bus, hub: !!e.hub });
      });

      // --- layer chips ------------------------------------------------------
      const chips = this.shadowRoot.querySelector('.chips');
      const on = { body: true, can: true, flexray: true, eth: true };
      LAYERS.forEach(l => {
        const b2 = document.createElement('button');
        b2.type = 'button';
        b2.setAttribute('aria-pressed', 'true');
        b2.innerHTML = `<span class="sw" style="background:${l.color}"></span><span class="lbl">${this._lang === 'en' ? l.labelEn : l.label}</span>`;
        l._chipSw = b2.querySelector('.sw');
        b2.onclick = () => {
          on[l.id] = !on[l.id];
          groups[l.id].visible = on[l.id];
          b2.setAttribute('aria-pressed', String(on[l.id]));
        };
        l._chipLbl = b2.querySelector('.lbl');
        chips.appendChild(b2);
      });
      // required attribution for the underlying 3D model (CC BY 4.0)
      const credit = document.createElement('span');
      credit.className = 'credit';
      credit.dataset.s = 'modelCredit';
      credit.innerHTML = STRINGS.modelCredit.de;
      chips.appendChild(credit);
      this._ecusRef = ECUS;
      this._layersRef = LAYERS;
      this._applyLang();

      // --- loop -------------------------------------------------------------
      const v = new THREE.Vector3();
      const resize = () => {
        const w = this.clientWidth || 640, h = this.clientHeight || 360;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      this._ro = new ResizeObserver(resize);
      this._ro.observe(this);
      resize();

      const t0 = performance.now();
      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        const t = (performance.now() - t0) / 1000;
        controls.update();

        pulses.forEach(p => {
          const u = (t * p.speed + p.offset) % 1;
          p.curve.getPointAt(u, v);
          p.mesh.position.copy(v);
          p.mesh.material.opacity = 0.25 + 0.75 * Math.sin(Math.PI * u);
        });
        ECUS.forEach((e, i) => {
          const s = 1 + 0.07 * Math.sin(t * 1.4 + i * 1.1);
          e._core.scale.setScalar(s);
          e._node.rotation.y = t * 0.22 + i;
          e._node.material.opacity = 0.6 + 0.3 * Math.sin(t * 1.1 + i * 0.8);
        });

        const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
        const near = controls.target.distanceTo(camera.position);
        const live = [];
        labels.forEach(l => {
          if (!on[l.layer]) { l.el.style.opacity = '0'; return; }
          v.copy(l.pos).project(camera);
          if (v.z >= 1) { l.el.style.opacity = '0'; return; }
          const cx = (v.x * 0.5 + 0.5) * w;
          const cy = (-v.y * 0.5 + 0.5) * h;
          // depth falloff: nodes behind the pivot fade so the near side stays readable
          const d = l.pos.distanceTo(camera.position);
          const t2 = Math.max(0, Math.min(1, (d - (near - sz.x * 0.4)) / (sz.x * 0.8)));
          l.depth = d;
          l.el.style.opacity = String(1 - 0.72 * t2);
          // flip the label outward from the vehicle's screen-space centre
          const left = cx < w * 0.5;
          l.el.classList.toggle('left', left);
          l.x = cx; l.y = cy; l.left = left;
          live.push(l);
        });
        // greedy vertical separation per side, nearest node keeps its anchor
        [true, false].forEach(side => {
          const col = live.filter(l => l.left === side).sort((a, c) => a.depth - c.depth);
          const placed = [];
          col.forEach(l => {
            let y = l.y;
            for (let k = 0; k < 24; k++) {
              const hit = placed.find(p => Math.abs(p.y - y) < 15 && Math.abs(p.x - l.x) < 130);
              if (!hit) break;
              y = hit.y + (y >= hit.y ? 15 : -15);
            }
            l.el.style.left = l.x + 'px';
            l.el.style.top = y + 'px';
            placed.push({ x: l.x, y });
          });
        });

        renderer.render(scene, camera);
      };
      tick();
    }
  }

  if (!customElements.get('car-net')) customElements.define('car-net', CarNet);
})();
