import { amortize } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=d6431262b6';

const config = {
  slug: 'mortgage',
  fields: [
    { id: 'price', label: 'Property price', type: 'money', default: 300000, min: 1, max: 100000000 },
    { id: 'deposit', label: 'Deposit', type: 'money', default: 60000, min: 0, max: 100000000, help: 'The amount you pay upfront. The mortgage is the price minus the deposit.' },
    { id: 'rate', label: 'Mortgage interest rate (per year)', type: 'percent', unit: '%', default: 4.75, min: 0, max: 30 },
    { id: 'term', label: 'Mortgage term (years)', type: 'int', default: 30, min: 1, max: 40 },
    { id: 'extra', label: 'Overpayment each month', type: 'money', default: 0, min: 0, max: 1000000, optional: true, help: 'Many lenders cap penalty-free overpayments (often around 10% of the balance a year). Check your deal.' },
    { id: 'tax', label: 'Property tax (per year)', type: 'money', default: 0, min: 0, max: 1000000, optional: true, group: 'Other housing costs (optional)', openGroup: true, help: 'For places where property tax is paid alongside the mortgage (for example much of the US). UK council tax is billed separately, but you can add it here to see your all-in cost.' },
    { id: 'insurance', label: 'Home insurance (per year)', type: 'money', default: 600, min: 0, max: 1000000, optional: true, group: 'Other housing costs (optional)' },
    { id: 'charges', label: 'Service charge / HOA fees (per month)', type: 'money', default: 0, min: 0, max: 100000, optional: true, group: 'Other housing costs (optional)', help: 'Leasehold service charges, ground rent or homeowners’ association fees.' },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  validate(v) {
    if (v.deposit >= v.price) return { deposit: 'The deposit must be less than the property price.' };
    return {};
  },
  assumptions(v, f) {
    return [
      `Repayment (capital and interest) mortgage of ${f.money(v.price - v.deposit)} over ${v.term} years.`,
      `Fixed rate of ${v.rate}% for the whole term. Most real deals revert to a different rate after a fixed period.`,
      v.extra > 0 ? `${f.money(v.extra)} overpaid every month with no early-repayment charges.` : 'No overpayments.',
      'Excludes arrangement fees, legal costs, stamp duty or closing costs, and mortgage insurance.',
    ];
  },
  compute(v, f) {
    const loan = v.price - v.deposit;
    const months = v.term * 12;
    const base = amortize({ principal: loan, annualRatePct: v.rate, months });
    const r = v.extra > 0 ? amortize({ principal: loan, annualRatePct: v.rate, months, extraMonthly: v.extra }) : base;
    const other = v.tax / 12 + v.insurance / 12 + v.charges;
    const allIn = base.payment + v.extra + other;
    const ltv = loan / v.price;
    const warnings = [];
    if (ltv > 0.95) warnings.push(`A loan-to-value of ${f.pct(ltv, 1)} is above what most lenders offer. You may need a larger deposit.`);
    const yearly = [];
    for (let y = 1; y <= Math.ceil(r.months / 12); y++) {
      const rows = r.schedule.slice((y - 1) * 12, y * 12);
      yearly.push({ year: y, paid: rows.reduce((s, x) => s + x.payment, 0), interest: rows.reduce((s, x) => s + x.interest, 0), principal: rows.reduce((s, x) => s + x.principal, 0), balance: rows.at(-1).balance });
    }
    const balAt = (s, y) => (y === 0 ? loan : (s[Math.min(s.length, y * 12) - 1] || { balance: 0 }).balance);
    const labels = Array.from({ length: v.term + 1 }, (_, y) => `Yr ${y}`);
    const series = [{ name: v.extra > 0 ? 'Balance with no overpayment' : 'Remaining balance', values: labels.map((_, y) => balAt(base.schedule, y)), tone: 1 }];
    if (v.extra > 0) series.push({ name: 'Balance with overpayment', values: labels.map((_, y) => balAt(r.schedule, y)), tone: 2 });
    return {
      kpis: [
        { key: 'payment', label: 'Monthly mortgage payment', value: base.payment, format: 'money', primary: true, sub: 'Capital and interest' },
        { key: 'allin', label: 'All-in monthly housing cost', value: allIn, format: 'money', sub: 'Mortgage, overpayment and the optional costs' },
        { key: 'interest', label: 'Total interest', value: r.totalInterest, format: 'money', sub: v.extra > 0 ? `${f.money(base.totalInterest - r.totalInterest)} saved by overpaying` : `Over ${v.term} years` },
        { key: 'months', label: 'Mortgage-free in', value: r.months, format: 'months', tone: v.extra > 0 ? 'good' : undefined, sub: `Loan-to-value ${f.pct(ltv, 1)}` },
      ],
      summary: `A <strong>${f.money(loan)}</strong> mortgage at <strong>${v.rate}%</strong> over ${v.term} years costs <strong>${f.money(base.payment)} a month</strong>, with <strong>${f.money(base.totalInterest)}</strong> of interest in total.${v.extra > 0 ? ` Overpaying ${f.money(v.extra)} a month would make you mortgage-free ${f.months(base.months - r.months)} sooner.` : ''}`,
      warnings,
      chart: { type: 'line', title: 'Mortgage balance over time', desc: 'Remaining mortgage balance at the end of each year.', labels, series, xTitle: 'Year' },
      breakdown: [
        { label: 'Property price', value: v.price, format: 'money' },
        { label: 'Deposit', value: v.deposit, format: 'money' },
        { label: 'Mortgage amount', value: loan, format: 'money', total: true },
        { label: 'Monthly capital + interest', value: base.payment, format: 'money' },
        { label: 'Monthly other costs', value: other, format: 'money' },
        { label: 'All-in monthly cost', value: allIn, format: 'money', total: true },
      ],
      table: {
        title: 'Year-by-year mortgage schedule', csv: 'mortgage-schedule.csv', preview: 10,
        columns: [{ label: 'Year', key: 'year', format: 'int' }, { label: 'Paid', key: 'paid', format: 'money' }, { label: 'Interest', key: 'interest', format: 'money' }, { label: 'Capital', key: 'principal', format: 'money' }, { label: 'Balance', key: 'balance', format: 'money' }],
        rows: yearly,
      },
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="mortgage"]'); if (el) mount(el, config); }
