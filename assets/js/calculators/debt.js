import { debtPayoff } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=d6431262b6';

const config = {
  slug: 'debt',
  fields: [
    { id: 'debts', label: 'Your debts', type: 'debts', help: '<span class="field-help">Add each debt with its balance, interest rate and minimum monthly payment.</span>', default: [
      { name: 'Credit card A', balance: 2500, aprPct: 22.9, minPayment: 75 },
      { name: 'Credit card B', balance: 1200, aprPct: 18.9, minPayment: 40 },
      { name: 'Personal loan', balance: 6000, aprPct: 9.9, minPayment: 120 },
    ] },
    { id: 'budget', label: 'Total you can pay each month', type: 'money', default: 600, min: 1, max: 10000000, help: 'Everything you can put towards these debts each month, including the minimums.' },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  validate(v) {
    const mins = v.debts.reduce((s, d) => s + Math.min(d.minPayment, d.balance), 0);
    if (v.budget < mins - 1e-9) return { budget: `Your monthly budget must cover the minimum payments, which add up to ${mins.toFixed(2)}.` };
    return {};
  },
  assumptions(v, f) {
    const mins = v.debts.reduce((s, d) => s + Math.min(d.minPayment, d.balance), 0);
    return [
      `You pay ${f.money(v.budget)} a month in total. ${f.money(mins)} covers the minimums and ${f.money(Math.max(0, v.budget - mins))} goes to the priority debt.`,
      'When a debt is paid off, its minimum payment rolls into the next priority debt.',
      'Interest charged monthly at APR ÷ 12. Rates and minimums stay the same, and no new borrowing.',
      '<strong>Snowball</strong> targets the smallest balance first. <strong>Avalanche</strong> targets the highest interest rate first.',
    ];
  },
  compute(v, f) {
    const s = debtPayoff(v.debts, v.budget, 'snowball');
    const a = debtPayoff(v.debts, v.budget, 'avalanche');
    if (!s.feasible || !a.feasible) {
      return { error: 'With this budget the debts are never repaid. Increase the monthly budget or lower the balances or rates.' };
    }
    const diff = s.totalInterest - a.totalInterest;
    const n = Math.max(s.months, a.months);
    const step = n > 36 ? 12 : n > 12 ? 3 : 1;
    const idx = []; for (let m = 0; m <= n; m += step) idx.push(m); if (idx.at(-1) !== n) idx.push(n);
    const total0 = v.debts.reduce((x, d) => x + d.balance, 0);
    const at = (t, m) => (m === 0 ? total0 : (t[Math.min(t.length, m) - 1] || { total: 0 }).total);
    const rows = s.debts.map((d) => ({ name: d.name, snow: d.paidOffMonth, aval: a.debts.find((x) => x.idx === d.idx)?.paidOffMonth }));
    return {
      kpis: [
        { key: 'aMonths', label: 'Avalanche: debt-free in', value: a.months, format: 'months', primary: true },
        { key: 'aInterest', label: 'Avalanche: total interest', value: a.totalInterest, format: 'money' },
        { key: 'sMonths', label: 'Snowball: debt-free in', value: s.months, format: 'months' },
        { key: 'sInterest', label: 'Snowball: total interest', value: s.totalInterest, format: 'money' },
      ],
      summary: diff > 0.005
        ? `With <strong>${f.money(v.budget)}</strong> a month, the avalanche method saves <strong>${f.money(diff)}</strong> in interest compared with the snowball. The snowball clears your first debt in ${f.months(Math.min(...s.debts.map((d) => d.paidOffMonth)))}, which some people find more motivating.`
        : `With <strong>${f.money(v.budget)}</strong> a month, both methods cost about the same here: you are debt-free in <strong>${f.months(a.months)}</strong>.`,
      chart: { type: 'line', title: 'Total debt remaining', desc: 'Total balance across all debts over time for each method.', labels: idx.map((m) => (step >= 12 ? `Yr ${m / 12}` : `M${m}`)), series: [{ name: 'Snowball', values: idx.map((m) => at(s.timeline, m)), tone: 3 }, { name: 'Avalanche', values: idx.map((m) => at(a.timeline, m)), tone: 2, dashed: true }] },
      breakdown: [
        { label: 'Total owed today', value: total0, format: 'money' },
        { label: 'Minimum payments', value: a.minimums, format: 'money' },
        { label: 'Interest: snowball', value: s.totalInterest, format: 'money' },
        { label: 'Interest: avalanche', value: a.totalInterest, format: 'money' },
        { label: 'Interest saved by avalanche', value: diff, format: 'money', total: true },
      ],
      table: {
        title: 'When each debt is paid off (months from now)', preview: 12,
        columns: [{ label: 'Debt', key: 'name', format: 'text' }, { label: 'Snowball', key: 'snow', format: 'months' }, { label: 'Avalanche', key: 'aval', format: 'months' }],
        rows,
      },
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="debt"]'); if (el) mount(el, config); }
