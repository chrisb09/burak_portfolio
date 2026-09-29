# Portfolio — Burak Kayabasi

Personal portfolio site built with HTML, CSS and JavaScript.

Live site: https://burakayabasi.github.io/portfolio/

## Project structure

```
.
├── index.html          # markup + the four page views (home, werdegang, projekte, kontakt)
├── css/
│   ├── tokens.css       # design tokens (colors, spacing, type) + base reset
│   └── style.css        # layout, components, animations
├── js/
│   ├── app.js            # routing between views, the DE/EN toggle, the intro splash
│   ├── car-net.js         # 3D vehicle network visualization
│   ├── particle-net.js    # animated background
│   ├── prr-surface.js     # 3D chart for the thesis project
│   ├── scenario-map.js    # map view for the thesis project
│   └── github-contrib.js  # GitHub contribution graph
├── assets/
│   ├── amg-gt3.glb        # 3D model
│   ├── amg-gt3-render.png
│   ├── logos/              # employer / university logos
│   └── documents/          # CV and profile photo
└── tools/
    └── render-car.html     # one-off script used to pre-render amg-gt3-render.png
```

## Running locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Privacy / storage (no cookie banner)

Theme (`bk-theme`) and language (`bk-lang`) are stored in `localStorage`
only — first-party, functional, never sent to a server. No tracking
cookies are set by this site, so no consent banner is required.

Note: the page loads third-party CDN assets (Google Fonts, three.js via
esm.sh, MapLibre, OpenFreeMap tiles, GitHub contributions API). Those
providers may log requests under their own policies; self-hosting them
would be a separate follow-up if stricter privacy is desired.
