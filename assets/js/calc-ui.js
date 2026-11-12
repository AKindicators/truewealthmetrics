/*!
 * TrueWealthMetrics calculator UI. Render functions are pure (string in/out) so the
 * site build can pre-render each calculator with its default result; mount() then
 * makes it interactive in the browser. Inputs never leave the visitor's device.
 */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CURRENCIES = { GBP: '£', USD: '$', EUR: '€' };
export const currencyOptions = [['GBP', 'GBP (£)'], ['USD', 'USD ($)'], ['EUR', 'EUR (€)']];

/* ---------------------------------------------------------------- format */

export function makeFormat(currency = 'GBP') {
  const cur = CURRENCIES[currency] ? currency : 'GBP';
  const m2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const m0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: 0 });
  const n0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  const f = {
    symbol: CURRENCIES[cur],
    // `|| 0` turns -0 (e.g. "less £0 other income") into 0 so it never shows as "-£0".
    money: (x) => (Number.isFinite(x) ? m2.format(Math.round(x * 100) / 100 || 0) : '—'),
    money0: (x) => (Number.isFinite(x) ? m0.format(Math.round(x) || 0) : '—'),
    compact: (x) => {
      if (!Number.isFinite(x)) return '';
      const a = Math.abs(x), s = x < 0 ? '-' : '';
      if (a >= 1e6) return `${s}${CURRENCIES[cur]}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`;
      if (a >= 1e3) return `${s}${CURRENCIES[cur]}${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
      return `${s}${CURRENCIES[cur]}${Math.round(a)}`;
    },
    pct: (x, dp = 2) => (Number.isFinite(x) ? `${(x * 100).toFixed(dp)}%` : '—'),
    int: (x) => (Number.isFinite(x) ? n0.format(x) : '—'),
    months: (m) => {
      if (!Number.isFinite(m)) return 'Never';
      const y = Math.floor(m / 12), r = Math.round(m - y * 12);
      const parts = [];
      if (y) parts.push(`${y} ${y === 1 ? 'year' : 'years'}`);
      if (r || !y) parts.push(`${r} ${r === 1 ? 'month' : 'months'}`);
      return parts.join(' ');
    },
    text: (x) => String(x),
  };
  f.any = (x, kind) => (f[kind] || f.text)(x);
  return f;
}

/* ---------------------------------------------------------------- values */

export function parseNumber(raw) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).replace(/[,£$€%\s]/g, '');
  if (s === '' || s === '-' || s === '.') return NaN;
  return /^-?\d*\.?\d+$|^-?\d+\.?$/.test(s) ? Number(s) : NaN;
}

export function defaults(config) {
  const v = {};
  for (const f of config.fields) {
    if (f.type === 'debts') v[f.id] = f.default.map((d) => ({ ...d }));
    else v[f.id] = f.default;
  }
  return v;
}

/** Validate raw values. Returns { values, errors } with numbers parsed. */
export function validate(config, raw) {
  const values = {};
  const errors = {};
  for (const f of config.fields) {
    if (f.type === 'select' || f.type === 'choice') { values[f.id] = raw[f.id] ?? f.default; continue; }
    if (f.type === 'debts') {
      values[f.id] = [];
      (raw[f.id] || []).forEach((d, i) => {
        const row = { name: String(d.name || `Debt ${i + 1}`).slice(0, 40), balance: parseNumber(d.balance), aprPct: parseNumber(d.aprPct), minPayment: parseNumber(d.minPayment) };
        const key = (k) => `${f.id}-${i}-${k}`;
        if (!(row.balance >= 0)) errors[key('balance')] = 'Enter a balance of 0 or more.';
        if (!(row.aprPct >= 0 && row.aprPct <= 100)) errors[key('aprPct')] = 'Enter an APR between 0 and 100%.';
        if (!(row.minPayment >= 0)) errors[key('minPayment')] = 'Enter a minimum payment of 0 or more.';
        values[f.id].push(row);
      });
      if (!values[f.id].some((d) => d.balance > 0)) errors[`${f.id}-0-balance`] = errors[`${f.id}-0-balance`] || 'Add at least one debt with a balance above 0.';
      continue;
    }
    if (f.showIf && !f.showIf(values)) { values[f.id] = f.default; continue; }
    const n = parseNumber(raw[f.id]);
    if (Number.isNaN(n)) {
      if (f.optional && String(raw[f.id] ?? '').trim() === '') { values[f.id] = f.optionalDefault ?? 0; continue; }
      errors[f.id] = `Enter a number for ${f.label.toLowerCase()}.`;
      continue;
    }
    if (f.type === 'int' && !Number.isInteger(n)) { errors[f.id] = 'Enter a whole number.'; continue; }
    if (f.min !== undefined && n < f.min) { errors[f.id] = f.minMsg || `Must be at least ${f.min}${f.unit === '%' ? '%' : ''}.`; continue; }
    if (f.max !== undefined && n > f.max) { errors[f.id] = f.maxMsg || `Must be ${f.max}${f.unit === '%' ? '%' : ''} or less.`; continue; }
    values[f.id] = n;
  }
  if (config.validate && !Object.keys(errors).length) Object.assign(errors, config.validate(values) || {});
  return { values, errors };
}

/* ----------------------------------------------------------------- form */

function fieldHTML(f, v, fmt, errors = {}) {
  const hidden = f.showIf && !f.showIf(v) ? ' hidden' : '';
  const helpId = f.help ? `${f.id}-help` : '';
  const errId = `${f.id}-err`;
  const err = errors[f.id];
  const describedBy = [helpId, errId].filter(Boolean).join(' ');
  const help = f.help ? `<p class="field-help" id="${helpId}">${f.help}</p>` : '';
  const errP = `<p class="field-err" id="${errId}"${err ? '' : ' hidden'}>${esc(err || '')}</p>`;
  if (f.type === 'choice') {
    const opts = f.options.map(([val, lab]) => `<label class="seg"><input type="radio" name="${f.id}" value="${esc(val)}"${String(v[f.id]) === String(val) ? ' checked' : ''}><span>${esc(lab)}</span></label>`).join('');
    return `<fieldset class="field field-choice" data-field="${f.id}"${hidden}><legend>${esc(f.label)}</legend><div class="segmented">${opts}</div>${help}</fieldset>`;
  }
  if (f.type === 'select') {
    const opts = f.options.map(([val, lab]) => `<option value="${esc(val)}"${String(v[f.id]) === String(val) ? ' selected' : ''}>${esc(lab)}</option>`).join('');
    return `<div class="field" data-field="${f.id}"${hidden}><label for="${f.id}">${esc(f.label)}</label><select id="${f.id}" name="${f.id}"${describedBy ? ` aria-describedby="${describedBy}"` : ''}>${opts}</select>${help}</div>`;
  }
  if (f.type === 'debts') {
    const rows = v[f.id].map((d, i) => debtRowHTML(f.id, d, i, errors)).join('');
    return `<fieldset class="field field-debts" data-field="${f.id}"><legend>${esc(f.label)}</legend>${help}<div class="debt-rows" data-debt-rows>${rows}</div><button type="button" class="btn btn-ghost btn-sm" data-action="add-debt">+ Add a debt</button></fieldset>`;
  }
  const isMoney = f.type === 'money';
  const prefix = isMoney ? `<span class="affix" data-currency-symbol aria-hidden="true">${esc(fmt.symbol)}</span>` : '';
  const suffix = f.unit ? `<span class="affix affix-end" aria-hidden="true">${esc(f.unit)}</span>` : '';
  const val = v[f.id] === undefined || v[f.id] === null ? '' : v[f.id];
  const mode = f.type === 'int' ? 'numeric' : 'decimal';
  return `<div class="field" data-field="${f.id}"${hidden}><label for="${f.id}">${esc(f.label)}${f.optional ? ' <span class="opt">(optional)</span>' : ''}</label><div class="input-wrap${prefix ? ' has-prefix' : ''}${suffix ? ' has-suffix' : ''}">${prefix}<input id="${f.id}" name="${f.id}" type="text" inputmode="${mode}" autocomplete="off" spellcheck="false" value="${esc(val)}"${describedBy ? ` aria-describedby="${describedBy}"` : ''}${err ? ' aria-invalid="true"' : ''}>${suffix}</div>${help}${errP}</div>`;
}

function debtRowHTML(id, d, i, errors = {}) {
  const k = (n) => `${id}-${i}-${n}`;
  const inp = (n, label, val, mode, unit, money) => {
    const err = errors[k(n)];
    return `<div class="field field-sm"><label for="${k(n)}">${label}</label><div class="input-wrap${money ? ' has-prefix' : ''}${unit ? ' has-suffix' : ''}">${money ? '<span class="affix" data-currency-symbol aria-hidden="true">£</span>' : ''}<input id="${k(n)}" data-debt="${n}" type="text" inputmode="${mode}" autocomplete="off" value="${esc(val)}" aria-describedby="${k(n)}-err"${err ? ' aria-invalid="true"' : ''}>${unit ? `<span class="affix affix-end" aria-hidden="true">${unit}</span>` : ''}</div><p class="field-err" id="${k(n)}-err"${err ? '' : ' hidden'}>${esc(err || '')}</p></div>`;
  };
  return `<div class="debt-row" data-debt-row><div class="field field-sm field-name"><label for="${k('name')}">Debt name</label><input id="${k('name')}" data-debt="name" type="text" autocomplete="off" value="${esc(d.name)}"></div>${inp('balance', 'Balance', d.balance, 'decimal', '', true)}${inp('aprPct', 'APR', d.aprPct, 'decimal', '%')}${inp('minPayment', 'Minimum payment', d.minPayment, 'decimal', '', true)}<button type="button" class="btn-icon" data-action="remove-debt" aria-label="Remove ${esc(d.name || `debt ${i + 1}`)}">×</button></div>`;
}

/* ---------------------------------------------------------------- chart */

/** Round axis: a "nice" step (1, 2, 2.5 or 5 × 10^n) and 2–5 gridlines that cover x. */
const niceAxis = (x) => {
  if (!(x > 0)) return { max: 1, step: 0.25, ticks: 4 };
  const raw = x / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const ticks = Math.max(2, Math.ceil(x / step - 1e-9));
  return { max: step * ticks, step, ticks };
};

export function chartSVG(chart, fmt, uid = 'c') {
  if (!chart) return '';
  const W = 520, H = 256, L = 72, R = 14, T = 14, B = 46;
  const iw = W - L - R, ih = H - T - B;
  const legend = chart.series.map((s, i) => `<li><span class="sw s${s.tone || i + 1}" aria-hidden="true"></span>${esc(s.name)}</li>`).join('');
  let body = '';
  if (chart.type === 'bars') {
    const { max } = niceAxis(Math.max(...chart.series.flatMap((s) => s.values)));
    const groups = chart.labels.length, per = chart.series.length;
    const gh = ih / groups, bh = Math.min(26, (gh - 10) / per);
    chart.labels.forEach((lab, gi) => {
      const y0 = T + gi * gh + (gh - bh * per) / 2;
      body += `<text class="ax" x="${L - 8}" y="${(y0 + (bh * per) / 2 + 4).toFixed(1)}" text-anchor="end">${esc(lab)}</text>`;
      chart.series.forEach((s, si) => {
        const w = Math.max(1, (s.values[gi] / max) * (iw - 70));
        const y = y0 + si * bh;
        body += `<rect class="s${s.tone || si + 1}" x="${L}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${(bh - 3).toFixed(1)}" rx="3"></rect><text class="val" x="${(L + w + 6).toFixed(1)}" y="${(y + bh / 2 + 2).toFixed(1)}">${esc(fmt.compact(s.values[gi]))}</text>`;
      });
    });
  } else {
    const n = chart.labels.length;
    const stacked = chart.type === 'area';
    const totals = chart.labels.map((_, i) => (stacked ? chart.series.reduce((s, se) => s + Math.max(0, se.values[i]), 0) : Math.max(...chart.series.map((se) => se.values[i]))));
    const { max, step: tickStep, ticks } = niceAxis(Math.max(...totals));
    const x = (i) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (val) => T + ih - (Math.max(0, val) / max) * ih;
    for (let k = 0; k <= ticks; k++) {
      const val = tickStep * k, yy = y(val).toFixed(1);
      body += `<line class="gl" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"></line><text class="ax" x="${L - 8}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${esc(fmt.compact(val))}</text>`;
    }
    const step = Math.max(1, Math.ceil(n / 6));
    // Label every `step`th point plus the last one, skipping a regular label that would crowd the last.
    chart.labels.forEach((lab, i) => { if ((i % step === 0 && (n - 1 - i >= step || i === n - 1)) || i === n - 1) body += `<text class="ax" x="${x(i).toFixed(1)}" y="${H - 22}" text-anchor="${i === n - 1 && n > 1 ? 'end' : i === 0 ? 'start' : 'middle'}">${esc(lab)}</text>`; });
    if (stacked) {
      const base = new Array(n).fill(0);
      chart.series.forEach((s, si) => {
        const top = s.values.map((v, i) => base[i] + Math.max(0, v));
        const pts = top.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        const back = base.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse().join(' ');
        body += `<polygon class="area s${s.tone || si + 1}" points="${pts} ${back}"></polygon>`;
        top.forEach((v, i) => { base[i] = v; });
      });
    } else {
      chart.series.forEach((s, si) => {
        const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        body += `<polyline class="line s${s.tone || si + 1}${s.dashed ? ' dashed' : ''}" points="${pts}"></polyline>`;
      });
    }
    body += `<line class="axis" x1="${L}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}"></line>`;
    if (chart.xTitle) body += `<text class="ax ax-title" x="${L + iw / 2}" y="${H - 2}" text-anchor="middle">${esc(chart.xTitle)}</text>`;
  }
  return `<figure class="chart"><figcaption><span class="chart-title" id="${uid}-t">${esc(chart.title)}</span><ul class="legend">${legend}</ul></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${uid}-t ${uid}-d" focusable="false"><desc id="${uid}-d">${esc(chart.desc)}</desc>${body}</svg></figure>`;
}

/* -------------------------------------------------------------- results */

function tableHTML(t, fmt) {
  if (!t || !t.rows.length) return '';
  const head = t.columns.map((c) => `<th scope="col"${c.format && c.format !== 'text' ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('');
  const limit = t.preview || 12;
  const rows = t.rows.map((r, i) => `<tr${i >= limit ? ' class="more" hidden' : ''}>${t.columns.map((c, ci) => (ci === 0 ? `<th scope="row">${esc(fmt.any(r[c.key], c.format))}</th>` : `<td class="num">${esc(fmt.any(r[c.key], c.format))}</td>`)).join('')}</tr>`).join('');
  const more = t.rows.length > limit ? `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-rows" aria-expanded="false">Show all ${t.rows.length} rows</button>` : '';
  const csv = t.csv ? `<button type="button" class="btn btn-ghost btn-sm" data-action="csv">Download CSV</button>` : '';
  return `<details class="table-block"><summary>${esc(t.title)}</summary><div class="table-scroll" tabindex="0" role="region" aria-label="${esc(t.title)}"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div><div class="btn-row">${more}${csv}</div></details>`;
}

export function resultsHTML(config, result, v, uid = 'r') {
  const fmt = makeFormat(v.currency);
  if (result.error) return `<div class="result-empty" role="status"><p><strong>${esc(result.error)}</strong></p><p>Fix the highlighted fields and the results will update.</p></div>`;
  const assumptions = (config.assumptions ? config.assumptions(v, fmt) : []).map((a) => `<li>${a}</li>`).join('');
  const kpis = result.kpis.map((k) => `<div class="kpi${k.primary ? ' kpi-primary' : ''}${k.tone ? ` tone-${k.tone}` : ''}"><p class="kpi-label">${esc(k.label)}</p><p class="kpi-value" data-kpi="${esc(k.key)}">${esc(fmt.any(k.value, k.format))}</p>${k.sub ? `<p class="kpi-sub">${k.sub}</p>` : ''}</div>`).join('');
  const warnings = (result.warnings || []).map((w) => `<p class="alert alert-warn">${w}</p>`).join('');
  const breakdown = result.breakdown && result.breakdown.length
    ? `<div class="breakdown"><h3 class="h-sm">Calculation breakdown</h3><dl>${result.breakdown.map((b) => `<div class="${b.total ? 'total' : ''}"><dt>${b.label}</dt><dd>${esc(fmt.any(b.value, b.format))}</dd></div>`).join('')}</dl></div>`
    : '';
  return `<div class="kpis">${kpis}</div>${warnings}<p class="summary">${result.summary || ''}</p>${assumptions ? `<details class="assumptions" open><summary>Assumptions used</summary><ul>${assumptions}</ul></details>` : ''}${chartSVG(result.chart, fmt, uid)}${breakdown}${tableHTML(result.table, fmt)}`;
}

/** Compact "headline result" bar shown fixed at the bottom of small screens. */
function resultBarInner(result, v) {
  const fmt = makeFormat(v.currency);
  if (!result || result.error) return '<span class="rb-label">Results paused</span><strong class="rb-value">Check inputs</strong><span class="rb-go">View</span>';
  const k = result.kpis.find((x) => x.primary) || result.kpis[0];
  return `<span class="rb-label">${esc(k.label)}</span><strong class="rb-value">${esc(fmt.any(k.value, k.format))}</strong><span class="rb-go">See full results</span>`;
}

/** Full static markup for a calculator (form + pre-computed default results). */
export function calculatorHTML(config) {
  const v = defaults(config);
  const fmt = makeFormat(v.currency);
  const { values, errors } = validate(config, v);
  const result = Object.keys(errors).length ? { error: 'Check the inputs.' } : config.compute(values, fmt);
  const groups = [];
  for (const f of config.fields) {
    const g = f.group || 'main';
    let grp = groups.find((x) => x.name === g);
    if (!grp) groups.push((grp = { name: g, fields: [] }));
    grp.fields.push(f);
  }
  const formBody = groups.map((g) => (g.name === 'main'
    ? g.fields.map((f) => fieldHTML(f, v, fmt)).join('')
    : `<details class="field-group"${g.fields.some((f) => f.openGroup) ? ' open' : ''}><summary>${esc(g.name)}</summary>${g.fields.map((f) => fieldHTML(f, v, fmt)).join('')}</details>`)).join('');
  return `<div class="calc" data-calc="${esc(config.slug)}">
<form class="calc-form" novalidate aria-labelledby="calc-form-title" data-form>
<h2 class="h-sm" id="calc-form-title">Your numbers</h2>
<a class="result-bar no-print" href="#calc-results-title" data-result-bar>${resultBarInner(result, values)}</a>
<p class="alert alert-error" data-error-summary role="alert" hidden></p>
${formBody}
<div class="btn-row"><button type="submit" class="btn btn-primary">Update results</button><button type="button" class="btn btn-ghost" data-action="reset">Reset</button></div>
<p class="privacy-note">Calculated in your browser. Nothing you enter is sent or stored.</p>
</form>
<section class="calc-results" aria-labelledby="calc-results-title" data-results-panel>
<div class="results-head"><h2 class="h-sm" id="calc-results-title">Results</h2><div class="btn-row btn-row-tight no-print"><button type="button" class="btn btn-ghost btn-sm" data-action="save-scenario">Save as scenario A</button><button type="button" class="btn btn-ghost btn-sm" data-action="print">Print / save PDF</button></div></div>
<div data-results aria-live="polite">${resultsHTML(config, result, values)}</div>
<div class="compare" data-compare hidden></div>
<p class="disclaimer">Estimates for education only, not financial advice. Results depend on the assumptions shown and are not guaranteed.</p>
</section>
</div>`;
}

/* ---------------------------------------------------------------- mount */

export function mount(root, config) {
  const form = root.querySelector('[data-form]');
  const out = root.querySelector('[data-results]');
  const summaryBox = root.querySelector('[data-error-summary]');
  const compareBox = root.querySelector('[data-compare]');
  const bar = root.querySelector('[data-result-bar]');
  const setBusy = (on) => { if (on) out.setAttribute('aria-busy', 'true'); else out.removeAttribute('aria-busy'); };
  const updateBar = (result, values) => { if (bar) bar.innerHTML = resultBarInner(result, values); };
  let last = null;
  let scenario = null;
  let timer = null;

  const readRaw = () => {
    const raw = {};
    for (const f of config.fields) {
      if (f.type === 'choice') raw[f.id] = (form.querySelector(`input[name="${f.id}"]:checked`) || {}).value ?? f.default;
      else if (f.type === 'debts') raw[f.id] = [...form.querySelectorAll('[data-debt-row]')].map((row) => Object.fromEntries([...row.querySelectorAll('[data-debt]')].map((i) => [i.dataset.debt, i.value])));
      else { const el = form.querySelector(`#${f.id}`); raw[f.id] = el ? el.value : f.default; }
    }
    return raw;
  };

  const showErrors = (errors) => {
    form.querySelectorAll('.field-err').forEach((p) => { p.hidden = true; p.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
    for (const [id, msg] of Object.entries(errors)) {
      const input = form.querySelector(`#${CSS.escape(id)}`);
      const p = form.querySelector(`#${CSS.escape(id)}-err`);
      if (input) input.setAttribute('aria-invalid', 'true');
      if (p) { p.textContent = msg; p.hidden = false; }
    }
    const n = Object.keys(errors).length;
    summaryBox.hidden = !n;
    summaryBox.textContent = n ? `${n === 1 ? 'One field needs' : `${n} fields need`} attention before the results can update.` : '';
  };

  const syncVisibility = (values) => {
    for (const f of config.fields) {
      if (!f.showIf) continue;
      const wrap = form.querySelector(`[data-field="${f.id}"]`);
      if (wrap) wrap.hidden = !f.showIf(values);
    }
    const sym = makeFormat(values.currency).symbol;
    root.querySelectorAll('[data-currency-symbol]').forEach((s) => { s.textContent = sym; });
  };

  const run = (focusResults = false, initial = false) => {
    const raw = readRaw();
    const pre = {};
    for (const f of config.fields) if (f.type === 'choice' || f.type === 'select') pre[f.id] = raw[f.id];
    syncVisibility(pre);
    const { values, errors } = validate(config, raw);
    showErrors(errors);
    const fmt = makeFormat(values.currency);
    setBusy(false);
    if (Object.keys(errors).length) {
      last = null;
      out.innerHTML = resultsHTML(config, { error: 'Results paused: some inputs need fixing.' }, values);
      updateBar(null, values);
      return;
    }
    let result;
    try { result = config.compute(values, fmt); } catch (e) { result = { error: 'These inputs could not be calculated. Try more typical values.' }; }
    last = { values, result };
    // The page ships with the default results pre-rendered; skip the redundant first repaint.
    if (initial && out.querySelector('.kpis')) return;
    out.innerHTML = resultsHTML(config, result, values, `r${Date.now() % 1e6}`);
    updateBar(result, values);
    renderCompare();
    if (focusResults && window.matchMedia('(max-width: 900px)').matches) {
      root.querySelector('[data-results-panel]').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const renderCompare = () => {
    if (!scenario || !last || last.result.error) { compareBox.hidden = true; return; }
    const fmt = makeFormat(last.values.currency);
    const rows = last.result.kpis.filter((k) => typeof k.value === 'number').map((k) => {
      const a = scenario.kpis.find((x) => x.key === k.key);
      if (!a || typeof a.value !== 'number') return '';
      const d = k.value - a.value;
      const diff = Number.isFinite(d) ? (k.format === 'months' ? `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt.months(Math.abs(d))}` : `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt.any(Math.abs(d), k.format)}`) : '—';
      return `<tr><th scope="row">${esc(k.label)}</th><td class="num">${esc(fmt.any(a.value, k.format))}</td><td class="num">${esc(fmt.any(k.value, k.format))}</td><td class="num">${esc(diff)}</td></tr>`;
    }).join('');
    compareBox.innerHTML = `<h3 class="h-sm">Scenario comparison</h3><p class="muted">Scenario A was saved from your earlier inputs. "Current" updates as you change them.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Scenario comparison"><table><thead><tr><th scope="col">Result</th><th scope="col" class="num">Scenario A</th><th scope="col" class="num">Current</th><th scope="col" class="num">Difference</th></tr></thead><tbody>${rows}</tbody></table></div><button type="button" class="btn btn-ghost btn-sm" data-action="clear-scenario">Clear scenario A</button>`;
    compareBox.hidden = false;
  };

  const schedule = () => { clearTimeout(timer); setBusy(true); timer = setTimeout(() => run(false), 180); };

  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
  form.addEventListener('submit', (e) => { e.preventDefault(); run(true); });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'reset') {
      const d = defaults(config);
      for (const f of config.fields) {
        if (f.type === 'choice') form.querySelectorAll(`input[name="${f.id}"]`).forEach((r) => { r.checked = String(r.value) === String(d[f.id]); });
        else if (f.type === 'debts') { form.querySelector('[data-debt-rows]').innerHTML = d[f.id].map((row, i) => debtRowHTML(f.id, row, i)).join(''); }
        else { const el = form.querySelector(`#${f.id}`); if (el) el.value = d[f.id]; }
      }
      run(false);
      form.querySelector('input, select')?.focus();
    } else if (a === 'add-debt') {
      const rows = form.querySelector('[data-debt-rows]');
      const i = rows.querySelectorAll('[data-debt-row]').length;
      if (i >= 12) return;
      const f = config.fields.find((x) => x.type === 'debts');
      rows.insertAdjacentHTML('beforeend', debtRowHTML(f.id, { name: `Debt ${i + 1}`, balance: '', aprPct: '', minPayment: '' }, i));
      rows.lastElementChild.querySelector('[data-debt="balance"]').focus();
      syncVisibility(readRaw());
    } else if (a === 'remove-debt') {
      const rows = form.querySelector('[data-debt-rows]');
      if (rows.querySelectorAll('[data-debt-row]').length <= 1) return;
      btn.closest('[data-debt-row]').remove();
      const f = config.fields.find((x) => x.type === 'debts');
      const data = readRaw()[f.id];
      rows.innerHTML = data.map((row, i) => debtRowHTML(f.id, row, i)).join('');
      rows.querySelector('input')?.focus();
      run(false);
    } else if (a === 'toggle-rows') {
      const tb = btn.closest('details').querySelectorAll('tr.more');
      const open = btn.getAttribute('aria-expanded') === 'true';
      tb.forEach((r) => { r.hidden = open; });
      btn.setAttribute('aria-expanded', String(!open));
      btn.textContent = open ? `Show all ${tb.length + 12} rows` : 'Show fewer rows';
    } else if (a === 'csv') {
      if (!last || !last.result.table) return;
      const t = last.result.table;
      const fmt = makeFormat(last.values.currency);
      const cell = (x) => `"${String(x).replace(/"/g, '""')}"`;
      const lines = [t.columns.map((c) => cell(c.label)).join(',')].concat(t.rows.map((r) => t.columns.map((c) => cell(typeof r[c.key] === 'number' && c.format !== 'months' ? r[c.key].toFixed(2) : fmt.any(r[c.key], c.format))).join(',')));
      const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: t.csv });
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (a === 'print') {
      window.print();
    } else if (a === 'save-scenario') {
      if (!last || last.result.error) return;
      scenario = { kpis: last.result.kpis.map((k) => ({ ...k })) };
      btn.textContent = 'Update scenario A';
      renderCompare();
      compareBox.querySelector('h3')?.setAttribute('tabindex', '-1');
    } else if (a === 'clear-scenario') {
      scenario = null; compareBox.hidden = true;
      root.querySelector('[data-action="save-scenario"]').textContent = 'Save as scenario A';
    }
  });

  run(false, true);
}
