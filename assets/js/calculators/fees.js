import { growth } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=a49c19ca5a';
import { returnWarnings } from './growth-shared.js?v=d7424a2b3f';

const config = {
  slug: 'fees',
  fields: [
    { id: 'initial', label: 'Starting balance', type: 'money', default: 10000, min: 0, max: 100000000 },
    { id: 'monthly', label: 'Monthly contribution', type: 'money', default: 200, min: 0, max: 10000000, optional: true },
    { id: 'years', label: 'Time period (years)', type: 'int', default: 20, min: 1, max: 100 },
    { id: 'rate', label: 'Expected return before fees (per year)', type: 'percent', unit: '%', default: 7, min: -50, max: 50 },
    { id: 'feeA', label: 'Annual fee (option A)', type: 'percent', unit: '%', default: 0.75, min: 0, max: 10, help: 'Total ongoing charges: fund costs plus platform or adviser fees.' },
    { id: 'feeB', label: 'Annual fee to compare (option B)', type: 'percent', unit: '%', default: 0.2, min: 0, max: 10, help: 'For example a lower-cost index fund. Use 0 to compare against no fees at all.' },
    { id: 'inflation', label: 'Inflation (per year)', type: 'percent', unit: '%', default: 0, min: -10, max: 30, optional: true },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  assumptions(v, f) {
    return [
      `The same ${v.rate}% annual return before fees for both options, compounded monthly.`,
      'Fees are taken monthly as a percentage of the balance (annual fee ÷ 12).',
      v.monthly > 0 ? `${f.money(v.monthly)} added at the end of every month.` : 'No monthly contributions.',
      'Excludes one-off charges, trading costs and tax.',
    ];
  },
  compute(v, f) {
    const base = { initial: v.initial, monthly: v.monthly, annualRatePct: v.rate, years: v.years, inflationPct: v.inflation };
    const a = growth({ ...base, annualFeePct: v.feeA });
    const b = growth({ ...base, annualFeePct: v.feeB });
    const hi = v.feeA >= v.feeB ? a : b, lo = v.feeA >= v.feeB ? b : a;
    const cost = lo.final - hi.final;
    const gross = growth({ ...base, annualFeePct: 0 });
    return {
      kpis: [
        { key: 'cost', label: 'Cost of the higher fee', value: cost, format: 'money', primary: true, tone: cost > 0 ? 'warn' : undefined, sub: `${gross.final > 0 ? f.pct(cost / gross.final, 1) : '—'} of the no-fee value` },
        { key: 'a', label: `Value with ${v.feeA}% fee (A)`, value: a.final, format: 'money' },
        { key: 'b', label: `Value with ${v.feeB}% fee (B)`, value: b.final, format: 'money' },
        { key: 'feesA', label: 'Fees paid under option A', value: a.totalFees, format: 'money' },
      ],
      summary: `Over ${v.years} years, a ${Math.max(v.feeA, v.feeB)}% fee instead of ${Math.min(v.feeA, v.feeB)}% leaves you about <strong>${f.money(cost)}</strong> worse off. That is more than the extra fees themselves, because money taken in fees can no longer grow.${v.inflation ? ` In today’s money the difference is about ${f.money(lo.real - hi.real)}.` : ''}`,
      warnings: returnWarnings(v.rate),
      chart: { type: 'line', title: 'Balance with each fee level', desc: 'Projected balance each year under option A and option B.', xTitle: 'Year', labels: a.yearly.map((r) => `Yr ${r.year}`), series: [{ name: `A: ${v.feeA}% fee`, values: a.yearly.map((r) => r.balance), tone: 3 }, { name: `B: ${v.feeB}% fee`, values: b.yearly.map((r) => r.balance), tone: 2 }] },
      breakdown: [{ label: 'Value with no fees', value: gross.final, format: 'money' }, { label: 'Value under option A', value: a.final, format: 'money' }, { label: 'Value under option B', value: b.final, format: 'money' }, { label: 'Difference', value: cost, format: 'money', total: true }],
      table: { title: 'Year-by-year comparison', csv: 'investment-fee-comparison.csv', columns: [{ label: 'Year', key: 'year', format: 'int' }, { label: 'Balance (A)', key: 'a', format: 'money' }, { label: 'Balance (B)', key: 'b', format: 'money' }, { label: 'Difference', key: 'd', format: 'money' }], rows: a.yearly.map((r, i) => ({ year: r.year, a: r.balance, b: b.yearly[i].balance, d: Math.abs(b.yearly[i].balance - r.balance) })) },
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="fees"]'); if (el) mount(el, config); }
