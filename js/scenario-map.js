// <scenario-map>: an interactive vector map (via MapLibre GL, loaded lazily
// from a CDN) that flies between the three thesis scenarios. Uses free
// vector tiles from OpenFreeMap (OpenMapTiles schema, no API key) so roads
// and buildings can be colored individually to match the site's palette,
// rather than tinting a raster image with a CSS filter.
(() => {
  const CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  const CSS_HASH = 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V';
  const JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  const JS_HASH = 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj';
  const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

  const VIEWS = {
    Melaten:   { center: [6.0500, 50.7842], zoom: 13.2 },
    Aachen:    { center: [6.0789, 50.7787], zoom: 15.5 },
    Jackerath: { center: [6.4750054610875685, 51.03320912172759], zoom: 14 }
  };

  // site palette: dark navy background, neon-green roads, pink buildings
  // light theme uses a pale surface with darker green roads for contrast
  const PALETTES = {
    dark: {
      BG: '#0f1118',
      WATER: '#141b2c',
      PARK: '#131a16',
      ROAD: '#39ff8f',
      ROAD_CASING: '#0a3a22',
      BUILDING: '#ff8fd1',
      VIG: 'radial-gradient(ellipse 92% 92% at 50% 45%, transparent 45%, rgba(15,17,24,0.5) 100%)',
    },
    light: {
      BG: '#e9ebf3',
      WATER: '#cfddf2',
      PARK: '#d7e9dc',
      ROAD: '#0b9b52',
      ROAD_CASING: '#bfe3cf',
      BUILDING: '#c65b9d',
      VIG: 'radial-gradient(ellipse 92% 92% at 50% 45%, transparent 55%, rgba(23,25,38,0.18) 100%)',
    },
  };

  function themeName() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function colorStyle(style, theme) {
    const P = PALETTES[theme || themeName()] || PALETTES.dark;
    const s = JSON.parse(JSON.stringify(style));
    for (const l of s.layers) {
      if (l.type === 'symbol') { l.layout = l.layout || {}; l.layout.visibility = 'none'; continue; }
      if (l.id === 'background') l.paint['background-color'] = P.BG;
      else if (l.id === 'water') l.paint['fill-color'] = P.WATER;
      else if (/^park|landcover|landuse/.test(l.id) && l.paint && l.paint['fill-color']) l.paint['fill-color'] = P.PARK;
      else if (l.id === 'building') {
        l.paint['fill-color'] = P.BUILDING;
        l.paint['fill-opacity'] = 0.55;
        delete l.paint['fill-outline-color'];
        l.maxzoom = 24; // this layer is designed to hand off to building-3d above z14 — keep it flat instead
      } else if (l.id === 'building-3d') {
        l.layout = l.layout || {}; l.layout.visibility = 'none';
      } else if (/^road_(motorway|trunk_primary|secondary_tertiary|minor|link|motorway_link|service_track|path_pedestrian)$/.test(l.id) && l.paint && l.paint['line-color']) {
        l.paint['line-color'] = P.ROAD;
      } else if (/casing/.test(l.id) && l.paint && l.paint['line-color']) {
        l.paint['line-color'] = P.ROAD_CASING;
      } else if (/label|place|poi|boundary|admin/i.test(l.id)) {
        l.layout = l.layout || {}; l.layout.visibility = 'none';
      }
    }
    return s;
  }

  let cssPromise, jsPromise, rawStylePromise;
  const loadCss = () => cssPromise || (cssPromise = new Promise((res) => {
    if (document.querySelector('link[data-maplibre]')) return res();
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = CSS; l.integrity = CSS_HASH; l.crossOrigin = 'anonymous';
    l.setAttribute('data-maplibre', '');
    l.onload = res; l.onerror = res;
    document.head.appendChild(l);
  }));
  const loadJs = () => jsPromise || (jsPromise = new Promise((res, rej) => {
    if (window.maplibregl) return res(window.maplibregl);
    const s = document.createElement('script');
    s.src = JS; s.integrity = JS_HASH; s.crossOrigin = 'anonymous';
    s.onload = () => res(window.maplibregl); s.onerror = rej;
    document.head.appendChild(s);
  }));
  // Only the raw tileset JSON is cached. The themed copy is derived fresh
  // on every use, so a theme toggle racing the initial load can't leave
  // the map stuck in the previous theme.
  const loadRawStyle = () => rawStylePromise || (rawStylePromise = fetch(STYLE_URL).then(r => r.json()));

  class ScenarioMap extends HTMLElement {
    static get observedAttributes() { return ['scenario']; }

    connectedCallback() {
      if (this._built) return;
      this._built = true;
      this._lang = this._lang || 'de';
      this._theme = themeName();
      this.style.display = 'block';
      if (getComputedStyle(this).position === 'static') this.style.position = 'relative';
      this.style.background = PALETTES[this._theme].BG;
      this.style.overflow = 'hidden';

      this._host = document.createElement('div');
      Object.assign(this._host.style, { position: 'absolute', inset: '0' });
      this.appendChild(this._host);

      this._vig = document.createElement('div');
      Object.assign(this._vig.style, {
        position: 'absolute', inset: '0', pointerEvents: 'none',
        background: PALETTES[this._theme].VIG
      });
      this.appendChild(this._vig);

      this._status = document.createElement('div');
      Object.assign(this._status.style, {
        position: 'absolute', inset: '0', display: 'flex', alignItems: 'center',
        justifyContent: 'center', font: '500 11px/1 Sora, system-ui, sans-serif',
        letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6d7183', pointerEvents: 'none'
      });
      this._status.textContent = this._lang === 'en' ? 'Loading map' : 'Karte wird geladen';
      this.appendChild(this._status);

      loadCss();
      Promise.all([loadJs(), loadRawStyle()]).then(([maplibregl, raw]) => {
        this._rawStyle = raw;
        const theme = themeName();
        this._theme = theme;
        this.style.background = PALETTES[theme].BG;
        if (this._vig) this._vig.style.background = PALETTES[theme].VIG;
        const v = VIEWS[this.getAttribute('scenario')] || VIEWS.Melaten;
        this._map = new maplibregl.Map({
          container: this._host,
          style: colorStyle(raw, theme),
          center: v.center,
          zoom: v.zoom,
          attributionControl: false,
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false
        });
        this._map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

        // small, always-collapsed credit line — the built-in attribution
        // control auto-expands on load and covers most of a small card
        const credit = document.createElement('div');
        this._credit = credit;
        this._paintCredit(theme);
        Object.assign(credit.style, {
          position: 'absolute', left: '8px', bottom: '4px', font: '9px/1.3 Sora, system-ui, sans-serif',
          pointerEvents: 'none', zIndex: 1
        });
        credit.innerHTML = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="color:inherit; pointer-events:auto;">OpenStreetMap</a> contributors';
        this._host.appendChild(credit);
        this._map.on('click', () => this._map.scrollZoom.enable());
        this._map.on('mouseout', () => this._map.scrollZoom.disable());
        this._map.on('load', () => { this._status.remove(); });
        this._ro = new ResizeObserver(() => this._map.resize());
        this._ro.observe(this);
      }).catch(() => {
        this._unavailable = true;
        this._status.textContent = this._lang === 'en' ? 'Map unavailable' : 'Karte nicht verfügbar';
      });
    }

    attributeChangedCallback(n, o, v) {
      if (n !== 'scenario' || !this._map || o === v) return;
      const view = VIEWS[v];
      if (view) this._map.flyTo({ center: view.center, zoom: view.zoom, duration: 900 });
    }

    disconnectedCallback() { if (this._ro) this._ro.disconnect(); }

    _paintCredit(theme) {
      if (!this._credit) return;
      this._credit.style.color = theme === 'light' ? 'rgba(23,25,38,0.45)' : 'rgba(255,255,255,0.35)';
    }

    setTheme(theme) {
      this._theme = theme;
      const P = PALETTES[theme] || PALETTES.dark;
      this.style.background = P.BG;
      if (this._vig) this._vig.style.background = P.VIG;
      this._paintCredit(theme);
      if (this._map && this._rawStyle) {
        this._map.setStyle(colorStyle(this._rawStyle, theme));
      }
      // toggled before the map finished loading: boot reads themeName()
      // fresh at creation time (above), so nothing more to do here.
    }

    setLang(lang) {
      this._lang = lang;
      if (!this._status || !this._status.isConnected) return;
      const en = lang === 'en';
      this._status.textContent = this._unavailable
        ? (en ? 'Map unavailable' : 'Karte nicht verfügbar')
        : (en ? 'Loading map' : 'Karte wird geladen');
    }
  }

  if (!customElements.get('scenario-map')) customElements.define('scenario-map', ScenarioMap);
})();
