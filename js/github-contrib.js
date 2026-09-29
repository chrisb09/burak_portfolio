// <github-contrib user="...">: a GitHub-style contribution heatmap built
// from a public, unauthenticated API — no token or backend required.
class GithubContrib extends HTMLElement {
  connectedCallback() {
    const user = this.getAttribute('user') || 'Burakayabasi';
    this._lang = this._lang || 'de';
    this.style.display = 'block';
    this.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'border:1px solid var(--color-neutral-800); border-radius:var(--radius-lg); padding:var(--space-4); background:color-mix(in oklab, var(--color-neutral-800) 30%, transparent); overflow-x:auto;';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex; justify-content:space-between; align-items:baseline; gap:var(--space-4); margin-bottom:var(--space-3); flex-wrap:wrap;';
    const title = document.createElement('div');
    title.style.cssText = 'color:var(--color-neutral-300); font-size:0.85rem;';
    title.textContent = this._t('GitHub-Aktivität', 'GitHub activity');
    const link = document.createElement('a');
    link.href = 'https://github.com/' + user;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '@' + user;
    link.style.cssText = 'font-size:0.85rem; color:var(--color-accent-300); text-decoration:none;';
    head.append(title, link);

    const body = document.createElement('div');
    body.style.cssText = 'display:flex; gap:6px; min-width:max-content;';

    const days = document.createElement('div');
    days.style.cssText = 'display:grid; grid-template-rows:repeat(7,11px); gap:3px; padding-top:17px; color:var(--color-neutral-400); font-size:0.7rem; line-height:11px;';
    const DOW = { de: ['', 'Mo', '', '', '', 'Fr', ''], en: ['', 'Mon', '', '', '', 'Fri', ''] };
    DOW.de.forEach((_, i) => {
      const d = document.createElement('div');
      d.textContent = DOW[this._lang][i];
      days.appendChild(d);
    });

    const cols = document.createElement('div');
    cols.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
    const months = document.createElement('div');
    months.style.cssText = 'position:relative; height:11px; color:var(--color-neutral-400); font-size:0.7rem; line-height:11px;';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-auto-flow:column; grid-template-rows:repeat(7,11px); gap:3px; min-width:max-content;';
    cols.append(months, grid);
    body.append(days, cols);

    const foot = document.createElement('div');
    foot.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:var(--space-4); margin-top:var(--space-3); color:var(--color-neutral-400); font-size:0.75rem;';
    const status = document.createElement('div');
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex; align-items:center; gap:4px;';
    foot.append(status, legend);

    const theme = (document.documentElement.getAttribute('data-theme') === 'light') ? 'light' : 'dark';
    this._theme = theme;
    const shadesFor = (t) => t === 'light' ? [
      'color-mix(in oklab, var(--color-neutral-700) 60%, transparent)',
      'rgba(11,155,82,0.22)', 'rgba(11,155,82,0.42)', 'rgba(11,155,82,0.68)', 'rgba(11,155,82,0.95)'
    ] : [
      'color-mix(in oklab, var(--color-neutral-700) 60%, transparent)',
      'rgba(57,255,143,0.22)', 'rgba(57,255,143,0.42)', 'rgba(57,255,143,0.68)', 'rgba(57,255,143,0.95)'
    ];
    const shades = shadesFor(theme);
    this._shadesFor = shadesFor;
    this._shades = shades;
    const swatch = (lvl) => {
      const s = document.createElement('span');
      s.style.cssText = 'width:11px; height:11px; border-radius:2px; display:block; background:' + shades[lvl] + ';';
      return s;
    };
    const less = document.createElement('span'); less.textContent = this._t('Weniger', 'Less');
    const more = document.createElement('span'); more.textContent = this._t('Mehr', 'More');
    legend.append(less, swatch(0), swatch(1), swatch(2), swatch(3), swatch(4), more);

    wrap.append(head, body, foot);
    this.appendChild(wrap);

    // keep references for setLang() to re-render against
    this._els = { title, less, more, status, days, months, grid };
    this._user = user;

    const cellFor = (level, label) => {
      const c = document.createElement('div');
      c.style.cssText = 'width:11px; height:11px; border-radius:2px; background:' + this._shades[level] + ';';
      if (label) c.title = label;
      return c;
    };
    this._cellFor = cellFor;

    const MONTHS = {
      de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
      en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    };
    this._MONTHS = MONTHS;
    const drawMonths = (weekMonth) => {
      months.innerHTML = '';
      let prev = -1, lastX = -99;
      weekMonth.forEach((m, i) => {
        if (m === prev) return;
        prev = m;
        const x = i * 14;
        if (x - lastX < 28) return;
        lastX = x;
        const l = document.createElement('div');
        l.textContent = MONTHS[this._lang][m];
        l.style.cssText = 'position:absolute; left:' + x + 'px; top:0; white-space:nowrap;';
        months.appendChild(l);
      });
    };
    this._drawMonths = drawMonths;

    const drawEmpty = () => {
      grid.innerHTML = '';
      for (let i = 0; i < 371; i++) grid.appendChild(cellFor(0));
      const now = new Date();
      const weekMonth = [];
      for (let w = 0; w < 53; w++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (52 - w) * 7);
        weekMonth.push(d.getMonth());
      }
      this._emptyWeekMonth = weekMonth;
      drawMonths(weekMonth);
    };

    drawEmpty();
    status.textContent = this._t('Lade …', 'Loading…');

    fetch('https://github-contributions-api.jogruber.de/v4/' + user + '?y=last')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(data => {
        const days = data.contributions || [];
        if (!days.length) throw new Error('empty');
        this._contribDays = days;
        this._renderContrib();
      })
      .catch(() => {
        this._fetchFailed = true;
        status.textContent = this._t('Aktivität nicht abrufbar — Profil auf GitHub ansehen', 'Activity unavailable — view profile on GitHub');
      });
  }

  _t(de, en) {
    return this._lang === 'en' ? en : de;
  }

  _renderContrib() {
    const days = this._contribDays;
    if (!days || !this._els) return;
    const { status, months, grid } = this._els;
    months.innerHTML = '';
    grid.innerHTML = '';
    const firstDow = new Date(days[0].date).getDay();
    for (let i = 0; i < firstDow; i++) {
      const pad = document.createElement('div');
      pad.style.cssText = 'width:11px; height:11px;';
      grid.appendChild(pad);
    }
    let total = 0;
    const weekMonth = [];
    const locale = this._lang === 'en' ? 'en-US' : 'de-DE';
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      total += d.count;
      const date = new Date(d.date);
      if ((firstDow + i) % 7 === 0) weekMonth.push(date.getMonth());
      const dt = date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
      const label = this._t(d.count + ' Beiträge · ' + dt, d.count + ' contributions · ' + dt);
      grid.appendChild(this._cellFor(Math.min(4, d.level || 0), label));
    }
    this._drawMonths(weekMonth);
    status.textContent = this._t(
      total.toLocaleString('de-DE') + ' Beiträge im letzten Jahr',
      total.toLocaleString('en-US') + ' contributions in the last year'
    );
  }

  setTheme(theme) {
    this._theme = theme;
    if (this._shadesFor) this._shades = this._shadesFor(theme);
    if (!this._els) return;
    // re-render swatches + grid with new shades
    const { grid } = this._els;
    if (this._contribDays) {
      this._renderContrib();
    } else if (grid) {
      Array.from(grid.children).forEach((c) => {
        c.style.background = this._shades[0];
      });
    }
    const legend = this.querySelectorAll('span');
    // legend swatches are spans with inline background; rebuild via parent
    const legendBox = this._els && this._els.status ? this._els.status.parentElement : null;
    if (legendBox) {
      const sw = legendBox.querySelectorAll('span[style*="width:11px"]');
      // first 5 swatches correspond to levels 0..4 (less/more are text spans)
      let idx = 0;
      sw.forEach((s) => {
        if (idx < 5) s.style.background = this._shades[idx++];
      });
    }
  }

  setLang(lang) {
    this._lang = lang;
    if (!this._els) return;
    const { title, less, more, status, days } = this._els;
    title.textContent = this._t('GitHub-Aktivität', 'GitHub activity');
    less.textContent = this._t('Weniger', 'Less');
    more.textContent = this._t('Mehr', 'More');
    const DOW = { de: ['', 'Mo', '', '', '', 'Fr', ''], en: ['', 'Mon', '', '', '', 'Fri', ''] };
    Array.from(days.children).forEach((el, i) => { el.textContent = DOW[lang][i]; });

    if (this._contribDays) {
      this._renderContrib();
    } else if (this._fetchFailed) {
      status.textContent = this._t('Aktivität nicht abrufbar — Profil auf GitHub ansehen', 'Activity unavailable — view profile on GitHub');
      if (this._emptyWeekMonth) this._drawMonths(this._emptyWeekMonth);
    } else {
      status.textContent = this._t('Lade …', 'Loading…');
      if (this._emptyWeekMonth) this._drawMonths(this._emptyWeekMonth);
    }
  }
}
if (!customElements.get('github-contrib')) customElements.define('github-contrib', GithubContrib);
