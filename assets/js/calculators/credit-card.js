import { cardPayoff } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=a0568ddf45';

const config = {
  slug: 'credit-card',
  fields: [
    { id: 'balance', label: 'Card balance', type: 'money', default: 5000, min: 1, max: 10000000 },
    { id: 'apr', label: 'Interest rate (APR)', type: 'percent', unit: '%', default: 19.9, min: 0, max: 100 },
    { id: 'mode', label: 'How you repay', type: 'choice', default: 'fixed', options: [['fixed', 'Fixed amount'], ['percent', 'Minimum % of balance']] },
    { id: 'payment', label: 'Monthly payment', type: 'money', default: 150, min: 0, max: 10000000, showIf: (v) => v.mode !== 'percent' },
    { id: 'percent', label: 'Minimum payment (% of balance)', type: 'percent', unit: '%', default: 3, min: 0.5, max: 100, showIf: (v) => v.mode === 'percent', help: 'Card minimums are often a small % of the balance (sometimes plus interest) with a fixed floor. Check your statement.' },
    { id: 'floor', label: 'Minimum payment floor', type: 'money', default: 25, min: 0, max: 100000, showIf: (v) => v.mode === 'percent' },
    { id: 'extra', label: 'Extra payment each month', type: 'money', default: 0, min: 0, max: 10000000, optional: true },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  assumptions(v, f) {
    return [
      `Interest charged monthly at ${v.apr}% ÷ 12. Card issuers usually calculate it daily, so real figures can differ slightly.`,
      v.mode === 'percent' ? `You pay ${v.percent}% of the balance each month (at least ${f.money(v.floor)}), so payments shrink as the balance falls.` : `You pay ${f.money(v.payment)} every month.`,
      v.extra > 0 ? `Plus an extra ${f.money(v.extra)} each month.` : 'No extra payments.',
      'No new spending, fees, promotional rates or missed payments.',
    ];
  },
  compute(v, f) {
    const args = { balance: v.balance, aprPct: v.apr, paymentType: v.mode, fixedPayment: v.payment, percent: v.percent, floor: v.floor };
    const r = cardPayoff({ ...args, extra: v.extra });
    const base = v.extra > 0 ? cardPayoff({ ...args, extra: 0 }) : r;
    if (r.never) {
      return {
        kpis: [
          { key: 'months', label: 'Time to clear the balance', value: Infinity, format: 'months', primary: true, tone: 'bad', sub: r.capped ? 'Not cleared within 100 years' : 'The payment does not cover the interest' },
          { key: 'first', label: 'First month’s payment', value: r.firstPayment, format: 'money' },
          { key: 'firstInterest', label: 'First month’s interest', value: r.firstInterest, format: 'money' },
        ],
        warnings: [`This payment is too low to ever clear the balance. The first month’s interest is <strong>${f.money(r.firstInterest)}</strong>, so you need to pay more than that every month.`],
        summary: 'Increase the monthly payment, add an extra payment, or look for a lower interest rate (for example a 0% balance transfer, which usually has a fee).',
      };
    }
    const labels = Array.from({ length: Math.ceil(base.months / 12) + 1 }, (_, y) => `Yr ${y}`);
    const at = (s, y) => (y === 0 ? v.balance : (s[Math.min(s.length, y * 12) - 1] || { balance: 0 }).balance);
    const series = [{ name: v.extra > 0 ? 'Without extra payment' : 'Balance', values: labels.map((_, y) => at(base.schedule, y)), tone: 3 }];
    if (v.extra > 0) series.push({ name: 'With extra payment', values: labels.map((_, y) => at(r.schedule, y)), tone: 2 });
    const warnings = [];
    if (v.mode === 'percent' && v.extra === 0) warnings.push('Paying only a percentage minimum keeps payments low but stretches repayment out for years. A fixed amount clears debt much faster.');
    return {
      kpis: [
        { key: 'months', label: 'Time to clear the balance', value: r.months, format: 'months', primary: true, sub: v.extra > 0 ? `${f.months(base.months - r.months)} sooner with the extra payment` : '' },
        { key: 'interest', label: 'Total interest', value: r.totalInterest, format: 'money' },
        { key: 'saved', label: 'Interest saved by extra payment', value: base.totalInterest - r.totalInterest, format: 'money', tone: v.extra > 0 ? 'good' : undefined },
        { key: 'total', label: 'Total repaid', value: r.totalPaid, format: 'money' },
      ],
      summary: `Repaying <strong>${f.money(v.balance)}</strong> at <strong>${v.apr}% APR</strong> takes <strong>${f.months(r.months)}</strong> and costs <strong>${f.money(r.totalInterest)}</strong> in interest.${v.extra > 0 ? ` The extra ${f.money(v.extra)} a month saves <strong>${f.money(base.totalInterest - r.totalInterest)}</strong>.` : ''}`,
      warnings,
      chart: { type: 'line', title: 'Card balance over time', desc: 'Remaining balance at the end of each year.', labels, series, xTitle: 'Year' },
      breakdown: [
        { label: 'Starting balance', value: v.balance, format: 'money' },
        { label: 'Interest paid', value: r.totalInterest, format: 'money' },
        { label: 'Total repaid', value: r.totalPaid, format: 'money', total: true },
      ],
      table: {
        title: 'Monthly payoff schedule', csv: 'credit-card-payoff.csv',
        columns: [{ label: 'Month', key: 'month', format: 'int' }, { label: 'Payment', key: 'payment', format: 'money' }, { label: 'Interest', key: 'interest', format: 'money' }, { label: 'Balance', key: 'balance', format: 'money' }],
        rows: r.schedule,
      },
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="credit-card"]'); if (el) mount(el, config); }
