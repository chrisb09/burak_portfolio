// <particle-net>: a lightweight animated background of drifting, linking
// dots on a canvas. Pauses itself when off-screen or the tab is hidden.
class ParticleNet extends HTMLElement {
  connectedCallback() {
    this.style.cssText = 'display:block; position:absolute; inset:0; width:100%; height:100%;';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block; width:100%; height:100%;';
    this.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: true });
    const THEMES = {
      dark: { dot: 'rgba(180,170,235,0.85)', line: '145,132,217' },
      light: { dot: 'rgba(90,92,140,0.85)', line: '106,95,208' },
    };
    const initialTheme = (document.documentElement.getAttribute('data-theme') === 'light') ? 'light' : 'dark';
    this._theme = initialTheme;
    let dotColor = this.getAttribute('dot-color') || THEMES[initialTheme].dot;
    let lineColor = this.getAttribute('line-color') || THEMES[initialTheme].line;
    // Allow app.js to switch themes live; explicit attributes win only on first paint.
    this.setTheme = (theme) => {
      this._theme = theme;
      if (!this.hasAttribute('dot-color')) dotColor = THEMES[theme] ? THEMES[theme].dot : THEMES.dark.dot;
      if (!this.hasAttribute('line-color')) lineColor = THEMES[theme] ? THEMES[theme].line : THEMES.dark.line;
    };
    const linkDist = parseFloat(this.getAttribute('link-distance') || '150');
    const density = parseFloat(this.getAttribute('density') || '5500');
    const BUCKETS = 4;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let pts = [], cols = 0, rows = 0, cellW = 0, cellH = 0, grid = [];
    let visible = true, running = false;
    const pointer = { x: -9999, y: -9999 };

    const build = () => {
      const n = Math.round(Math.max(56, Math.min(180, (w * h) / density)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        r: 1 + Math.random() * 1.5
      }));
      cols = Math.max(1, Math.ceil(w / linkDist));
      rows = Math.max(1, Math.ceil(h / linkDist));
      cellW = w / cols; cellH = h / rows;
      grid = Array.from({ length: cols * rows }, () => []);
    };

    const resize = () => {
      const rect = this.getBoundingClientRect();
      const nw = Math.max(1, Math.round(rect.width)), nh = Math.max(1, Math.round(rect.height));
      if (nw === w && nh === h) return;
      w = nw; h = nh;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    const maxSq = linkDist * linkDist;
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());

    const step = () => {
      if (!visible) { running = false; return; }

      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) { p.vx *= -1; p.x = Math.max(0, Math.min(w, p.x)); }
        if (p.y < 0 || p.y > h) { p.vy *= -1; p.y = Math.max(0, Math.min(h, p.y)); }
      }

      for (let i = 0; i < grid.length; i++) grid[i].length = 0;
      for (const p of pts) {
        const cx = Math.min(cols - 1, Math.max(0, (p.x / cellW) | 0));
        const cy = Math.min(rows - 1, Math.max(0, (p.y / cellH) | 0));
        grid[cy * cols + cx].push(p);
      }

      ctx.clearRect(0, 0, w, h);
      for (let b = 0; b < BUCKETS; b++) paths[b] = new Path2D();

      // neighbour cells only: right, down, down-right, down-left
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const cell = grid[cy * cols + cx];
          if (!cell.length) continue;
          for (let a = 0; a < cell.length; a++) {
            const p = cell[a];
            for (let b2 = a + 1; b2 < cell.length; b2++) link(p, cell[b2]);
            for (const [ox, oy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
              const nx = cx + ox, ny = cy + oy;
              if (nx < 0 || nx >= cols || ny >= rows) continue;
              const nb = grid[ny * cols + nx];
              for (let k = 0; k < nb.length; k++) link(p, nb[k]);
            }
          }
        }
      }

      for (let b = 0; b < BUCKETS; b++) {
        const t = (b + 1) / BUCKETS;
        ctx.strokeStyle = 'rgba(' + lineColor + ',' + (t * t * 0.5).toFixed(3) + ')';
        ctx.lineWidth = 0.4 + t * 1.0;
        ctx.stroke(paths[b]);
      }

      const pr = linkDist * 1.2, prSq = pr * pr;
      const near = [];
      ctx.beginPath();
      for (const p of pts) {
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < prSq) {
          near.push(p);
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pointer.x, pointer.y);
        }
      }
      if (near.length) {
        ctx.strokeStyle = 'rgba(' + lineColor + ',0.35)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }

      ctx.fillStyle = dotColor;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (const p of pts) { ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); }
      ctx.fill();
      if (near.length) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        for (const p of near) { ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); }
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      this._raf = requestAnimationFrame(step);
    };

    function link(p, q) {
      const dx = p.x - q.x, dy = p.y - q.y;
      const dSq = dx * dx + dy * dy;
      if (dSq >= maxSq) return;
      const t = 1 - Math.sqrt(dSq) / linkDist;
      const b = Math.min(BUCKETS - 1, (t * BUCKETS) | 0);
      paths[b].moveTo(p.x, p.y);
      paths[b].lineTo(q.x, q.y);
    }

    const start = () => { if (running) return; running = true; this._raf = requestAnimationFrame(step); };

    this._onMove = (e) => {
      const rect = this.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    this._onLeave = () => { pointer.x = -9999; pointer.y = -9999; };
    this._onVis = () => { visible = !document.hidden && this._inView !== false; if (visible) start(); };

    this._io = new IntersectionObserver((es) => {
      this._inView = es[0].isIntersecting;
      visible = this._inView && !document.hidden;
      if (visible) start();
    }, { threshold: 0 });
    this._io.observe(this);

    this._ro = new ResizeObserver(resize);
    this._ro.observe(this);
    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('pointerleave', this._onLeave, { passive: true });
    document.addEventListener('visibilitychange', this._onVis);
    resize();
    start();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._io) this._io.disconnect();
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerleave', this._onLeave);
    document.removeEventListener('visibilitychange', this._onVis);
  }
}

if (!customElements.get('particle-net')) customElements.define('particle-net', ParticleNet);
