import { growth, roiSimple, annualisedReturn } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=a49c19ca5a';
import { freqOptions, freqName, growthChart, growthTable, returnWarnings } from './growth-shared.js?v=d7424a2b3f';

const proj = (v) => v.mode === 'projection';
const actual = (v) => v.mode !== 'projection';

const config = {
  slug: 'roi',
  fields: [
    { id: 'mode', label: 'What do you want to calculate?', type: 'choice', default: 'actual', options: [['actual', 'ROI on a past investment'], ['projection', 'Projected ROI']] },
    { id: 'invested', label: 'Amount invested', type: 'money', default: 10000, min: 0.01, max: 1000000000, showIf: actual },
    { id: 'finalValue', label: 'Value now (or sale proceeds)', type: 'money', default: 14500, min: 0, max: 1000000000, showIf: actual, help: 'Include any income received, such as dividends or rent, and subtract costs such as fees.' },
    { id: 'held', label: 'Years held', type: 'number', default: 5, min: 0, max: 100, showIf: actual, help: 'Used for the annualised return (CAGR). Enter 0 if you only need the total ROI.' },
    { id: 'initial', label: 'Initial investment', type: 'money', default: 10000, min: 0, max: 1000000000, showIf: proj },
    { id: 'monthly', label: 'Monthly contribution', type: 'money', default: 200, min: 0, max: 10000000, optional: true, showIf: proj },
    { id: 'years', label: 'Investment period (years)', type: 'int', default: 10, min: 1, max: 100, showIf: proj },
    { id: 'rate', label: 'Expected return before fees (per year)', type: 'percent', unit: '%', default: 7, min: -50, max: 50, showIf: proj },
    { id: 'fee', label: 'Annual fees', type: 'percent', unit: '%', default: 0.5, min: 0, max: 10, optional: true, showIf: proj },
    { id: 'infl', label: 'Inflation (per year)', type: 'percent', unit: '%', default: 2.5, min: -10, max: 30, optional: true, showIf: proj },
    { id: 'freq', label: 'Compounding', type: 'select', default: '12', options: freqOptions, showIf: proj },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  validate(v) {
    if (proj(v) && v.initial + v.monthly <= 0) return { initial: 'Enter an initial investment or a monthly contribution.' };
    return {};
  },
  assumptions(v, f) {
    if (actual(v)) return ['ROI = (value now − amount invested) ÷ amount invested.', 'CAGR assumes a single investment held for the whole period, with no money added or withdrawn.', 'Tax is not included.'];
    return [
      `A steady ${v.rate}% a year before fees, compounded ${freqName[v.freq]}${v.fee ? `, less ${v.fee}% a year in fees` : ''}.`,
      v.monthly > 0 ? `${f.money(v.monthly)} invested at the end of every month.` : 'No monthly contributions.',
      'ROI compares the ending value with the total amount you paid in. Annualised return is the money-weighted rate (IRR) that accounts for when each payment was made.',
      'No tax or withdrawals.',
    ];
  },
  compute(v, f) {
    if (actual(v)) {
      const r = roiSimple({ invested: v.invested, finalValue: v.finalValue, years: v.held });
      return {
        kpis: [
          { key: 'roi', label: 'Return on investment (ROI)', value: r.roi, format: 'pct', primary: true, tone: r.profit >= 0 ? 'good' : 'bad' },
          { key: 'profit', label: r.profit >= 0 ? 'Profit' : 'Loss', value: r.profit, format: 'money' },
          { key: 'cagr', label: 'Annualised return (CAGR)', value: v.held > 0 ? r.cagr : NaN, format: 'pct', sub: v.held > 0 ? `Per year over ${v.held} years` : 'Enter years held to see this' },
        ],
        summary: `Turning <strong>${f.money(v.invested)}</strong> into <strong>${f.money(v.finalValue)}</strong> is a ${r.profit >= 0 ? 'gain' : 'loss'} of <strong>${f.money(Math.abs(r.profit))}</strong>, an ROI of <strong>${f.pct(r.roi)}</strong>.${v.held > 0 ? ` Spread over ${v.held} years, that is equivalent to <strong>${f.pct(r.cagr)} a year</strong> compounded.` : ''}`,
        chart: { type: 'bars', title: 'Invested vs value now', desc: 'Amount invested compared with the current value.', labels: ['Invested', 'Value now'], series: [{ name: 'Amount', values: [v.invested, v.finalValue], tone: 1 }] },
        breakdown: [{ label: 'Value now', value: v.finalValue, format: 'money' }, { label: 'Amount invested', value: -v.invested, format: 'money' }, { label: r.profit >= 0 ? 'Profit' : 'Loss', value: r.profit, format: 'money', total: true }, { label: 'Profit ÷ amount invested', value: r.roi, format: 'pct', total: true }],
      };
    }
    const g = growth({ initial: v.initial, monthly: v.monthly, annualRatePct: v.rate, compoundsPerYear: +v.freq, years: v.years, annualFeePct: v.fee, inflationPct: v.infl });
    const profit = g.final - g.totalContributions;
    const roi = g.totalContributions > 0 ? profit / g.totalContributions : NaN;
    const irr = annualisedReturn({ initial: v.initial, monthly: v.monthly, months: g.months, final: g.final });
    return {
      kpis: [
        { key: 'final', label: 'Ending value', value: g.final, format: 'money', primary: true, sub: v.infl ? `${f.money(g.real)} in today’s money` : `After ${v.years} years` },
        { key: 'profit', label: profit >= 0 ? 'Profit' : 'Loss', value: profit, format: 'money', sub: `On ${f.money(g.totalContributions)} invested` },
        { key: 'roi', label: 'Total ROI', value: roi, format: 'pct' },
        { key: 'irr', label: 'Annualised return (IRR)', value: irr, format: 'pct', sub: 'After fees, per year' },
      ],
      summary: `Investing ${f.money(g.totalContributions)} in total would grow to about <strong>${f.money(g.final)}</strong>, an ROI of <strong>${f.pct(roi)}</strong>. Allowing for when each payment went in, that is an annualised return of about <strong>${f.pct(irr)}</strong> after fees.`,
      warnings: returnWarnings(v.rate),
      chart: growthChart(g, 'Projected growth'),
      breakdown: [{ label: 'Total invested', value: g.totalContributions, format: 'money' }, { label: 'Growth', value: g.totalGrowth, format: 'money' }, { label: 'Fees', value: -g.totalFees, format: 'money' }, { label: 'Ending value', value: g.final, format: 'money', total: true }],
      table: growthTable(g, 'roi-projection.csv', !!v.infl),
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="roi"]'); if (el) mount(el, config); }
