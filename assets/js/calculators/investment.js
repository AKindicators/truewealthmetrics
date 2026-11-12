import { growth } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=a49c19ca5a';
import { freqOptions, freqName, growthChart, growthTable, returnWarnings } from './growth-shared.js?v=d7424a2b3f';

const config = {
  slug: 'investment',
  fields: [
    { id: 'initial', label: 'Initial investment', type: 'money', default: 10000, min: 0, max: 100000000 },
    { id: 'monthly', label: 'Monthly contribution', type: 'money', default: 500, min: 0, max: 10000000, optional: true },
    { id: 'rate', label: 'Expected return (per year, before fees)', type: 'percent', unit: '%', default: 7, min: -50, max: 50, help: 'An assumption, not a promise. Long-run stock market averages have historically been in single digits after inflation, with large swings from year to year.' },
    { id: 'years', label: 'Investment period (years)', type: 'int', default: 20, min: 1, max: 100 },
    { id: 'fee', label: 'Annual fees', type: 'percent', unit: '%', default: 0, min: 0, max: 10, optional: true, help: 'Fund and platform charges as a % of your balance each year.' },
    { id: 'inflation', label: 'Inflation (per year)', type: 'percent', unit: '%', default: 0, min: -10, max: 30, optional: true },
    { id: 'freq', label: 'Compounding', type: 'select', default: '12', options: freqOptions, group: 'Advanced' },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  assumptions(v, f) {
    return [
      `A steady ${v.rate}% a year before fees, compounded ${freqName[v.freq]}. Real investment returns go up and down.`,
      v.monthly > 0 ? `${f.money(v.monthly)} invested at the end of every month.` : 'No monthly contributions.',
      v.fee ? `Fees of ${v.fee}% a year, taken monthly from the balance.` : 'No fees.',
      v.inflation ? `Inflation of ${v.inflation}% a year for the today’s-money figure.` : 'No inflation adjustment.',
      'No tax or withdrawals.',
    ];
  },
  compute(v, f) {
    const g = growth({ initial: v.initial, monthly: v.monthly, annualRatePct: v.rate, compoundsPerYear: +v.freq, years: v.years, annualFeePct: v.fee, inflationPct: v.inflation });
    const gain = g.final - g.totalContributions;
    const kpis = [
      { key: 'final', label: 'Estimated value', value: g.final, format: 'money', primary: true, sub: `After ${v.years} years${v.fee ? ', after fees' : ''}` },
      { key: 'contrib', label: 'Total invested', value: g.totalContributions, format: 'money' },
      { key: 'gain', label: gain >= 0 ? 'Investment growth' : 'Investment loss', value: gain, format: 'money' },
    ];
    if (v.fee) kpis.push({ key: 'fees', label: 'Fees paid', value: g.totalFees, format: 'money' });
    if (v.inflation) kpis.push({ key: 'real', label: 'Value in today’s money', value: g.real, format: 'money' });
    return {
      kpis,
      summary: `Investing ${f.money(v.initial)}${v.monthly > 0 ? ` plus ${f.money(v.monthly)} a month` : ''} for ${v.years} years at ${v.rate}%${v.fee ? ` less ${v.fee}% fees` : ''} could grow to about <strong>${f.money(g.final)}</strong>${v.inflation ? `, roughly <strong>${f.money(g.real)}</strong> in today’s money` : ''}. This is an illustration: actual returns will differ.`,
      warnings: returnWarnings(v.rate),
      chart: growthChart(g, 'How your investment could grow'),
      breakdown: [{ label: 'Total invested', value: g.totalContributions, format: 'money' }, { label: 'Growth before fees', value: g.totalGrowth, format: 'money' }, { label: 'Fees', value: -g.totalFees, format: 'money' }, { label: 'Estimated value', value: g.final, format: 'money', total: true }],
      table: growthTable(g, 'investment-growth.csv', !!v.inflation),
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="investment"]'); if (el) mount(el, config); }
