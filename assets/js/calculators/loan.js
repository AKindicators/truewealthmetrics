import { amortize } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=d6431262b6';

const config = {
  slug: 'loan',
  fields: [
    { id: 'amount', label: 'Loan amount', type: 'money', default: 15000, min: 1, max: 100000000, minMsg: 'Enter a loan amount greater than 0.' },
    { id: 'rate', label: 'Interest rate (per year)', type: 'percent', unit: '%', default: 7.5, min: 0, max: 100, help: 'The annual interest rate. Lenders’ quoted APR can include fees, so your actual payment may differ slightly.' },
    { id: 'years', label: 'Loan term (years)', type: 'int', default: 5, min: 0, max: 50 },
    { id: 'months', label: 'Plus extra months', type: 'int', default: 0, min: 0, max: 11, help: 'For terms like 2 years 6 months.' },
    { id: 'extra', label: 'Extra payment each month', type: 'money', default: 0, min: 0, max: 10000000, optional: true, help: 'Optional overpayment on top of the required payment. Check your lender allows overpayments without a fee.' },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  validate(v) {
    const n = v.years * 12 + v.months;
    if (n < 1) return { years: 'The loan term must be at least 1 month.' };
    if (n > 600) return { years: 'The loan term must be 50 years or less.' };
    return {};
  },
  assumptions(v, f) {
    return [
      `Fixed rate of ${v.rate}% a year for the whole term; monthly rate = ${v.rate}% ÷ 12.`,
      `${f.months(v.years * 12 + v.months)} of equal monthly payments, paid at the end of each month.`,
      v.extra > 0 ? `An extra ${f.money(v.extra)} is paid every month and goes straight to the balance.` : 'No overpayments.',
      'No arrangement fees, payment holidays or early-repayment charges.',
    ];
  },
  compute(v, f) {
    const months = v.years * 12 + v.months;
    const base = amortize({ principal: v.amount, annualRatePct: v.rate, months });
    const r = v.extra > 0 ? amortize({ principal: v.amount, annualRatePct: v.rate, months, extraMonthly: v.extra }) : base;
    const saved = base.totalInterest - r.totalInterest;
    const warnings = [];
    if (v.rate > 30) warnings.push('That rate is unusually high. Double-check it, and be cautious about borrowing at this cost.');
    const yearsN = Math.ceil(base.months / 12);
    const balAt = (sched, y) => (y === 0 ? v.amount : (sched[Math.min(sched.length, y * 12) - 1] || { balance: 0 }).balance);
    const labels = Array.from({ length: yearsN + 1 }, (_, y) => `Yr ${y}`);
    const series = [{ name: v.extra > 0 ? 'Balance with no overpayment' : 'Remaining balance', values: labels.map((_, y) => balAt(base.schedule, y)), tone: 1 }];
    if (v.extra > 0) series.push({ name: 'Balance with overpayment', values: labels.map((_, y) => balAt(r.schedule, y)), tone: 2 });
    return {
      kpis: [
        { key: 'payment', label: 'Monthly payment', value: base.payment, format: 'money', primary: true, sub: v.extra > 0 ? `${f.money(base.payment + v.extra)} including your overpayment` : 'Required payment each month' },
        { key: 'interest', label: 'Total interest', value: r.totalInterest, format: 'money', sub: v.extra > 0 ? `${f.money(saved)} less than without overpaying` : 'Cost of borrowing over the term' },
        { key: 'total', label: 'Total repaid', value: r.totalPaid, format: 'money' },
        { key: 'months', label: 'Time to repay', value: r.months, format: 'months', tone: v.extra > 0 && r.months < base.months ? 'good' : undefined, sub: v.extra > 0 ? `${f.months(base.months - r.months)} sooner` : 'Full term' },
      ],
      summary: `Borrowing <strong>${f.money(v.amount)}</strong> at <strong>${v.rate}%</strong> over ${f.months(months)} costs <strong>${f.money(base.payment)} a month</strong> and <strong>${f.money(base.totalInterest)}</strong> in interest.${v.extra > 0 ? ` Overpaying ${f.money(v.extra)} a month would clear it in ${f.months(r.months)} and save about <strong>${f.money(saved)}</strong> in interest.` : ' Try adding an extra monthly payment to see how much interest you could save.'}`,
      warnings,
      chart: { type: 'line', title: 'Balance over time', desc: `Remaining loan balance at the end of each year${v.extra > 0 ? ', with and without the overpayment' : ''}.`, labels, series, xTitle: 'Year' },
      breakdown: [
        { label: 'Amount borrowed', value: v.amount, format: 'money' },
        { label: 'Interest paid', value: r.totalInterest, format: 'money' },
        { label: 'Total repaid', value: r.totalPaid, format: 'money', total: true },
      ],
      table: {
        title: 'Monthly repayment schedule', csv: 'loan-repayment-schedule.csv',
        columns: [{ label: 'Month', key: 'month', format: 'int' }, { label: 'Payment', key: 'payment', format: 'money' }, { label: 'Interest', key: 'interest', format: 'money' }, { label: 'Principal', key: 'principal', format: 'money' }, { label: 'Balance', key: 'balance', format: 'money' }],
        rows: r.schedule,
      },
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="loan"]'); if (el) mount(el, config); }
