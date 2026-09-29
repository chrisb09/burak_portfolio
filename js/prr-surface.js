// <prr-surface>: a 3D surface chart of Packet Reception Rate against
// transmission range and interval, for one of three thesis scenarios.
// Data below are averages over 5 simulation seeds per scenario.
(() => {
  const THREE_URL = 'https://esm.sh/three@0.184.0';
  const ORBIT_URL = 'https://esm.sh/three@0.184.0/examples/jsm/controls/OrbitControls.js';

  const RANGES = [20, 60, 100, 120, 140, 160, 180, 200];
  const INTERVALS = [0.2, 0.4, 0.6, 0.8, 1.0, 2.0, 3.0, 4.0, 5.0, 10.0];

  // PRR [%] at 500 kB, rows = transmission interval, columns = range (mean over 5 seeds)
  const DATA = {
    Melaten: [
      [49.40, 21.10, 18.68, 11.15, 11.38, 10.10, 8.41, 7.90],
      [74.36, 48.78, 30.53, 25.80, 23.16, 21.33, 27.19, 24.21],
      [84.22, 56.73, 41.39, 43.21, 35.20, 42.04, 36.43, 33.10],
      [89.66, 77.85, 55.93, 50.30, 41.95, 47.74, 39.51, 38.99],
      [90.46, 75.18, 58.75, 52.78, 49.11, 52.67, 54.41, 52.58],
      [95.05, 87.42, 72.69, 77.25, 76.92, 71.43, 70.55, 71.74],
      [96.55, 93.39, 87.23, 84.28, 83.24, 80.33, 79.22, 79.79],
      [97.49, 92.77, 88.43, 86.76, 86.12, 83.84, 85.20, 86.21],
      [96.71, 94.98, 91.79, 89.53, 88.04, 89.59, 89.45, 89.05],
      [98.58, 98.21, 96.10, 92.39, 95.01, 92.66, 92.65, 92.08]
    ],
    Aachen: [
      [33.64, 10.50, 5.78, 7.45, 10.06, 4.73, 9.36, 7.47],
      [45.96, 28.93, 14.36, 12.28, 18.45, 20.00, 16.06, 12.90],
      [72.95, 47.55, 44.29, 28.76, 30.26, 21.27, 29.05, 24.18],
      [79.96, 68.91, 40.45, 50.96, 43.31, 38.21, 50.72, 27.31],
      [88.19, 70.41, 48.84, 60.62, 48.60, 43.95, 51.98, 44.19],
      [92.55, 77.26, 75.41, 83.23, 77.64, 75.81, 68.19, 76.44],
      [93.71, 88.34, 78.56, 84.70, 85.60, 84.70, 73.88, 79.79],
      [98.27, 92.58, 91.80, 91.95, 85.40, 89.47, 84.40, 84.52],
      [93.87, 94.87, 92.23, 94.19, 91.36, 86.77, 86.18, 89.96],
      [98.91, 95.82, 96.40, 95.04, 96.50, 90.73, 93.12, 91.82]
    ],
    Jackerath: [
      [87.04, 57.25, 47.31, 56.85, 37.20, 52.23, 43.01, 42.53],
      [98.65, 78.61, 77.19, 67.81, 67.12, 65.92, 83.16, 55.39],
      [98.99, 88.36, 86.10, 86.10, 79.26, 87.95, 77.12, 79.16],
      [100.00, 94.61, 93.99, 94.87, 87.90, 86.65, 89.02, 86.25],
      [98.87, 96.57, 91.07, 92.43, 91.26, 93.60, 87.84, 88.08],
      [100.00, 95.31, 96.57, 96.20, 94.93, 90.90, 93.43, 92.42],
      [100.00, 98.40, 98.40, 98.32, 96.66, 95.61, 95.19, 93.89],
      [100.00, 98.80, 98.53, 98.13, 96.22, 96.48, 97.36, 95.29],
      [100.00, 98.76, 96.74, 100.00, 98.86, 96.63, 95.49, 97.84],
      [100.00, 98.75, 98.62, 99.09, 97.28, 99.46, 99.43, 97.98]
    ]
  };

  const NX = RANGES.length, NZ = INTERVALS.length;
  const W = 4.2, D = 5.4, HMAX = 2.4;
  const X0 = -W / 2, Z0 = -D / 2;
  const px = i => X0 + (i / (NX - 1)) * W;
  const pz = j => Z0 + (j / (NZ - 1)) * D;
  const py = v => (v / 100) * HMAX;

  class PrrSurface extends HTMLElement {
    static get observedAttributes() { return ['scenario']; }

    attributeChangedCallback(n, o, v) {
      if (n === 'scenario' && v && this._apply) this._apply(v);
    }

    connectedCallback() {
      if (this._up) return;
      this._up = true;
      this._lang = this._lang || 'de';
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; position:relative; }
          .wrap { position:absolute; inset:0; overflow:hidden; }
          canvas { display:block; width:100%; height:100%; touch-action:none; cursor:grab; }
          canvas:active { cursor:grabbing; }
          .ov { position:absolute; inset:0; pointer-events:none;
                font-family:Sora,system-ui,sans-serif; }
          .tk { position:absolute; transform:translate(-50%,-50%); white-space:nowrap;
                font-size:8.5px; letter-spacing:0.04em; font-variant-numeric:tabular-nums;
                color:var(--color-neutral-700, #595d6c); }
          .axl { position:absolute; transform:translate(-50%,-50%); white-space:nowrap;
                 font-size:9px; letter-spacing:0.13em; text-transform:uppercase;
                 color:var(--color-neutral-500, #9397ab); }
          .tip { position:absolute; transform:translate(-50%,-100%); white-space:nowrap;
                 padding:6px 10px; border-radius:9px; opacity:0; transition:opacity .12s;
                 border:1px solid var(--color-neutral-700, #595d6c);
                 background:color-mix(in oklab, var(--color-bg, #161826) 90%, transparent);
                 font-size:10.5px; color:var(--color-text, #e9e9ed);
                 font-variant-numeric:tabular-nums; }
          .tip i { font-style:normal; color:var(--color-neutral-400, #b2b6ca); }
          .unit { position:absolute; top:13px; left:15px; font-size:9.5px; letter-spacing:0.14em;
                  text-transform:uppercase; color:var(--color-neutral-500, #9397ab); }
          .unit b { display:block; margin-top:5px; font-weight:400; font-size:8.5px;
                    letter-spacing:0.1em; color:var(--color-neutral-700, #595d6c); }
          .hint { position:absolute; top:13px; right:15px; font-size:9.5px; letter-spacing:0.13em;
                  text-transform:uppercase; color:var(--color-neutral-800, #3f424d);
                  transition:opacity .5s; }
          .bar { position:absolute; left:15px; bottom:14px; display:flex; align-items:center; gap:7px; }
          .bar .g { width:74px; height:4px; border-radius:2px;
                    background:linear-gradient(to right, #9184d9, #5fc8b0, #39ff8f); }
          .bar span { font-size:8.5px; letter-spacing:0.08em; font-variant-numeric:tabular-nums;
                      color:var(--color-neutral-700, #595d6c); }
          .load { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
                  display:flex; align-items:center; gap:9px; padding:9px 15px; border-radius:999px;
                  border:1px solid var(--color-neutral-800, #3f424d);
                  background:color-mix(in oklab, var(--color-bg, #161826) 76%, transparent);
                  backdrop-filter:blur(6px); font-size:10px; letter-spacing:0.14em;
                  text-transform:uppercase; pointer-events:none; transition:opacity .35s;
                  color:var(--color-neutral-400, #b2b6ca); }
          .load .sp { width:12px; height:12px; border-radius:50%; flex-shrink:0;
                      border:1.5px solid color-mix(in oklab, #39ff8f 28%, transparent);
                      border-top-color:#39ff8f; animation:spin 0.85s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
        </style>
        <div class="wrap">
          <div class="ov">
            <div class="unit">PRR [%] · 500 kB<b></b></div>
            <div class="hint" data-s="hint">Ziehen · Scrollen</div>
            <div class="bar"><span>0</span><span class="g"></span><span>100</span></div>
            <div class="tip"></div>
          </div>
          <div class="load"><span class="sp"></span><span data-s="loading">Diagramm wird geladen</span></div>
        </div>`;
      this._boot();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      this._ro && this._ro.disconnect();
    }

    setLang(lang) {
      this._lang = lang;
      const root = this.shadowRoot;
      if (!root) return;
      const en = lang === 'en';
      const STRINGS = {
        hint: { de: 'Ziehen · Scrollen', en: 'Drag · Scroll' },
        loading: { de: 'Diagramm wird geladen', en: 'Loading chart' }
      };
      root.querySelectorAll('[data-s]').forEach((el) => {
        const s = STRINGS[el.dataset.s];
        if (s) el.textContent = en ? s.en : s.de;
      });
      if (this._axX) this._axX.textContent = en ? 'Range [m]' : 'Reichweite [m]';
      if (this._axZ) this._axZ.textContent = en ? 'Transmission interval [s]' : 'Sendeintervall [s]';
    }

    setTheme(theme) {
      this._theme = theme;
      if (this._mats) {
        const light = theme === 'light';
        this._mats.faint.color.set(light ? 0xb9bdd0 : 0x3f424d);
        this._mats.fainter.color.set(light ? 0xd9dce8 : 0x3f424d);
        this._mats.mesh.color.set(light ? 0xffffff : 0x0d1014);
        if (this._mats.hi) this._mats.hi.set(light ? '#0b9b52' : '#39ff8f');
        if (this._refreshColors) this._refreshColors();
      }
    }

    async _boot() {
      const [THREE, { OrbitControls }] = await Promise.all([import(THREE_URL), import(ORBIT_URL)]);
      const load = this.shadowRoot.querySelector('.load');
      if (load) { load.style.opacity = '0'; setTimeout(() => load.remove(), 400); }

      const wrap = this.shadowRoot.querySelector('.wrap');
      const ov = this.shadowRoot.querySelector('.ov');
      const tip = this.shadowRoot.querySelector('.tip');
      const unitSub = this.shadowRoot.querySelector('.unit b');

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      wrap.insertBefore(renderer.domElement, ov);
      const cv = renderer.domElement;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(6.2, 4.3, 6.9);
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 0.8);
      key.position.set(5, 9, 4);
      scene.add(key);

      const controls = new OrbitControls(camera, cv);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.minDistance = 6.2;
      controls.maxDistance = 17;
      controls.minPolarAngle = 0.3;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.target.set(0, HMAX * 0.52, 0);
      controls.addEventListener('start', () => {
        this.shadowRoot.querySelector('.hint').style.opacity = '0';
      });

      // --- surface ---------------------------------------------------------
      const pos = new Float32Array(NX * NZ * 3);
      const colArr = new Float32Array(NX * NZ * 3);
      const idx = [];
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const k = (j * NX + i) * 3;
        pos[k] = px(i); pos[k + 1] = 0; pos[k + 2] = pz(j);
      }
      for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
      geo.setIndex(idx);
      const surface = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
        vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.93
      }));
      surface.name = 'prr-surface';
      // vertices morph on scenario change, so cached bounds go stale
      surface.frustumCulled = false;
      scene.add(surface);

      // mesh lines following the same vertices
      const lineIdx = [];
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX - 1; i++) lineIdx.push(j * NX + i, j * NX + i + 1);
      for (let i = 0; i < NX; i++) for (let j = 0; j < NZ - 1; j++) lineIdx.push(j * NX + i, (j + 1) * NX + i);
      const lgeo = new THREE.BufferGeometry();
      lgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      lgeo.setIndex(lineIdx);
      const isLight = (this._theme || document.documentElement.getAttribute('data-theme')) === 'light';
      const mesh = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({
        color: isLight ? 0xffffff : 0x0d1014, transparent: true, opacity: 0.4
      }));
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      scene.add(mesh);

      // --- frame: floor grid + back walls ----------------------------------
      const faint = new THREE.LineBasicMaterial({ color: isLight ? 0xb9bdd0 : 0x3f424d, transparent: true, opacity: 0.45, depthWrite: false });
      const fainter = new THREE.LineBasicMaterial({ color: isLight ? 0xd9dce8 : 0x3f424d, transparent: true, opacity: 0.22, depthWrite: false });
      const seg = (a, b, m) => scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), m));
      const V = (x, y, z) => new THREE.Vector3(x, y, z);
      for (let i = 0; i < NX; i++) seg(V(px(i), 0, Z0), V(px(i), 0, Z0 + D), i === 0 ? faint : fainter);
      for (let j = 0; j < NZ; j++) seg(V(X0, 0, pz(j)), V(X0 + W, 0, pz(j)), j === 0 ? faint : fainter);
      [0, 25, 50, 75, 100].forEach(v => {
        const y = py(v);
        seg(V(X0, y, Z0), V(X0 + W, y, Z0), fainter);
        seg(V(X0 + W, y, Z0), V(X0 + W, y, Z0 + D), fainter);
      });
      seg(V(X0 + W, 0, Z0), V(X0 + W, py(100), Z0), faint);

      // --- overlay labels --------------------------------------------------
      const mk = (cls, txt) => { const d = document.createElement('div'); d.className = cls; d.textContent = txt; ov.appendChild(d); return d; };
      const xTicks = [0, 2, 4, 6, 7].map(i => ({ el: mk('tk', String(RANGES[i])), i }));
      const zTicks = [0, 2, 4, 5, 7, 9].map(j => ({ el: mk('tk', String(INTERVALS[j])), j }));
      const yTicks = [0, 50, 100].map(v => ({ el: mk('tk', String(v)), v }));
      const axX = mk('axl', this._lang === 'en' ? 'Range [m]' : 'Reichweite [m]');
      const axZ = mk('axl', this._lang === 'en' ? 'Transmission interval [s]' : 'Sendeintervall [s]');
      this._axX = axX;
      this._axZ = axZ;

      // --- values ----------------------------------------------------------
      const lo = new THREE.Color('#9184d9'), mid = new THREE.Color('#5fc8b0'), hi = new THREE.Color(isLight ? '#0b9b52' : '#39ff8f');
      this._mats = { faint, fainter, mesh: mesh.material, hi };
      const cur = new Float32Array(NX * NZ);
      const target = new Float32Array(NX * NZ);
      let scen = this.getAttribute('scenario') || 'Melaten';

      const shade = (t, out) => {
        if (t < 0.5) out.copy(lo).lerp(mid, t / 0.5);
        else out.copy(mid).lerp(hi, (t - 0.5) / 0.5);
        return out;
      };
      const tmp = new THREE.Color();

      this._apply = name => {
        if (!DATA[name]) return;
        scen = name;
        const m = DATA[name];
        for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) target[j * NX + i] = m[j][i];
        unitSub.textContent = name;
      };
      this._apply(scen);
      cur.set(target);

      const writeVerts = () => {
        for (let n = 0; n < NX * NZ; n++) {
          pos[n * 3 + 1] = py(cur[n]);
          shade(Math.max(0, Math.min(1, cur[n] / 100)), tmp);
          colArr[n * 3] = tmp.r; colArr[n * 3 + 1] = tmp.g; colArr[n * 3 + 2] = tmp.b;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        lgeo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
      };
      writeVerts();
      this._refreshColors = writeVerts;

      // --- hover -----------------------------------------------------------
      const ray = new THREE.Raycaster();
      const ptr = new THREE.Vector2();
      cv.addEventListener('pointermove', e => {
        const r = cv.getBoundingClientRect();
        ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ptr, camera);
        const hit = ray.intersectObject(surface, false)[0];
        if (!hit) { tip.style.opacity = '0'; this._hover = null; return; }
        const i = Math.round(((hit.point.x - X0) / W) * (NX - 1));
        const j = Math.round(((hit.point.z - Z0) / D) * (NZ - 1));
        const v = DATA[scen][Math.max(0, Math.min(NZ - 1, j))][Math.max(0, Math.min(NX - 1, i))];
        const vStr = this._lang === 'en' ? v.toFixed(2) : v.toFixed(2).replace('.', ',');
        tip.innerHTML = `<i>${RANGES[i]} m · ${INTERVALS[j]} s</i> &nbsp;${vStr} %`;
        tip.style.opacity = '1';
        this._hover = V(px(i), py(cur[j * NX + i]), pz(j));
      });
      cv.addEventListener('pointerleave', () => { tip.style.opacity = '0'; this._hover = null; });

      // --- loop ------------------------------------------------------------
      const resize = () => {
        const w = this.clientWidth || 640, h = this.clientHeight || 400;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.fov = camera.aspect < 1.5 ? Math.min(46, 32 * (1.5 / camera.aspect)) : 32;
        camera.updateProjectionMatrix();
      };
      this._ro = new ResizeObserver(resize);
      this._ro.observe(this);
      resize();

      const v3 = new THREE.Vector3();
      const put = (el, p, ox, oy) => {
        v3.copy(p).project(camera);
        el.style.left = ((v3.x * 0.5 + 0.5) * cv.clientWidth + (ox || 0)) + 'px';
        el.style.top = ((-v3.y * 0.5 + 0.5) * cv.clientHeight + (oy || 0)) + 'px';
      };

      // screen-space position of a world point
      const sp2 = new THREE.Vector2();
      const toScreen = (x, y, z, out) => {
        v3.set(x, y, z).project(camera);
        out.set((v3.x * 0.5 + 0.5) * cv.clientWidth, (-v3.y * 0.5 + 0.5) * cv.clientHeight);
        return out;
      };
      const A = new THREE.Vector2(), B = new THREE.Vector2(), Cc = new THREE.Vector2(), Dd = new THREE.Vector2();

      const layoutLabels = () => {
        toScreen(0, py(50), 0, Cc);                       // centre of the surface
        // range-axis edge: whichever of the two z edges sits lower on screen
        toScreen(0, 0, Z0, A);
        toScreen(0, 0, Z0 + D, B);
        const zEdge = A.y >= B.y ? Z0 : Z0 + D;
        const zMid = A.y >= B.y ? A : B;
        const nz = new THREE.Vector2(zMid.x - Cc.x, zMid.y - Cc.y).normalize();

        // interval-axis edge: whichever of the two x edges sits on the left on screen
        toScreen(X0, 0, 0, A);
        toScreen(X0 + W, 0, 0, B);
        const xEdge = A.x <= B.x ? X0 : X0 + W;
        const xMid = A.x <= B.x ? A : B;
        const nx = new THREE.Vector2(xMid.x - Cc.x, xMid.y - Cc.y).normalize();

        const cw = cv.clientWidth, ch = cv.clientHeight;
        const place = (el, sx, sy, n, dist) => {
          const x = Math.max(24, Math.min(cw - 24, sx + n.x * dist));
          const y = Math.max(30, Math.min(ch - 30, sy + n.y * dist));
          el.style.left = x + 'px';
          el.style.top = y + 'px';
        };
        xTicks.forEach(t => { toScreen(px(t.i), 0, zEdge, Dd); place(t.el, Dd.x, Dd.y, nz, 20); });
        zTicks.forEach(t => { toScreen(xEdge, 0, pz(t.j), Dd); place(t.el, Dd.x, Dd.y, nx, 20); });
        toScreen(0, 0, zEdge, Dd); place(axX, Dd.x, Dd.y, nz, 44);
        toScreen(xEdge, 0, 0, Dd); place(axZ, Dd.x, Dd.y, nx, 48);

        // PRR scale sits on the screen-left of the two rear vertical edges
        const yx = xEdge === X0 ? X0 : X0 + W;
        const yz = zEdge === Z0 ? Z0 + D : Z0;
        toScreen(yx, py(50), yz, A);
        const ny = new THREE.Vector2(A.x - Cc.x, A.y - Cc.y).normalize();
        yTicks.forEach(t => { toScreen(yx, py(t.v), yz, Dd); place(t.el, Dd.x, Dd.y, ny, 18); });
      };

      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        controls.update();
        let moved = false;
        for (let n = 0; n < cur.length; n++) {
          const d = target[n] - cur[n];
          if (Math.abs(d) > 0.01) { cur[n] += d * 0.14; moved = true; }
        }
        if (moved) writeVerts();

        layoutLabels();
        if (this._hover) put(tip, this._hover, 0, -6);

        renderer.render(scene, camera);
      };
      tick();
    }
  }

  if (!customElements.get('prr-surface')) customElements.define('prr-surface', PrrSurface);
})();
