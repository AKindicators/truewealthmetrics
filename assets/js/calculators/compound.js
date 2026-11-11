import { growth } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=d6431262b6';
import { freqOptions, freqName, growthChart, growthTable, returnWarnings } from './growth-shared.js?v=d7424a2b3f';

const config = {
  slug: 'compound',
  fields: [
    { id: 'principal', label: 'Starting amount', type: 'money', default: 1000, min: 0, max: 100000000 },
    { id: 'monthly', label: 'Monthly contribution', type: 'money', default: 200, min: 0, max: 10000000, optional: true },
    { id: 'rate', label: 'Interest rate or return (per year)', type: 'percent', unit: '%', default: 8, min: -50, max: 50 },
    { id: 'years', label: 'Time period (years)', type: 'int', default: 20, min: 1, max: 100 },
    { id: 'freq', label: 'Compounding', type: 'select', default: '12', options: freqOptions, help: 'How often interest is added. The rate is treated as a nominal annual rate.' },
    { id: 'timing', label: 'Contributions are added', type: 'choice', default: 'end', options: [['end', 'End of each month'], ['start', 'Start of each month']] },
    { id: 'inflation', label: 'Inflation (per year)', type: 'percent', unit: '%', default: 0, min: -10, max: 30, optional: true, help: 'Optional. Shows what the final amount would be worth in today’s money.' },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  assumptions(v, f) {
    return [
      `${v.rate}% a year, compounded ${freqName[v.freq]}, every year with no variation.`,
      v.monthly > 0 ? `${f.money(v.monthly)} added at the ${v.timing === 'start' ? 'start' : 'end'} of every month.` : 'No regular contributions.',
      v.inflation ? `Inflation of ${v.inflation}% a year is used to show today’s value.` : 'No inflation adjustment.',
      'No tax, fees or withdrawals.',
    ];
  },
  compute(v, f) {
    const g = growth({ initial: v.principal, monthly: v.monthly, annualRatePct: v.rate, compoundsPerYear: +v.freq, timing: v.timing, years: v.years, inflationPct: v.inflation });
    const interest = g.final - g.totalContributions;
    const kpis = [
      { key: 'final', label: 'Final balance', value: g.final, format: 'money', primary: true, sub: `After ${v.years} years` },
      { key: 'contrib', label: 'Total paid in', value: g.totalContributions, format: 'money' },
      { key: 'interest', label: interest >= 0 ? 'Interest earned' : 'Value lost', value: interest, format: 'money' },
    ];
    if (v.inflation) kpis.push({ key: 'real', label: 'Final balance in today’s money', value: g.real, format: 'money', sub: `At ${v.inflation}% inflation` });
    return {
      kpis,
      summary: `Starting with ${f.money(v.principal)}${v.monthly > 0 ? ` and adding ${f.money(v.monthly)} a month` : ''}, at ${v.rate}% compounded ${freqName[v.freq]} you would have about <strong>${f.money(g.final)}</strong> after ${v.years} years. ${interest >= 0 ? `<strong>${f.money(interest)}</strong> of that is interest, ${g.final > 0 ? f.pct(interest / g.final, 0) : '0%'} of the total.` : ''}`,
      warnings: returnWarnings(v.rate),
      chart: growthChart(g),
      breakdown: [{ label: 'Starting amount', value: v.principal, format: 'money' }, { label: 'Monthly contributions', value: g.totalContributions - v.principal, format: 'money' }, { label: 'Interest', value: interest, format: 'money' }, { label: 'Final balance', value: g.final, format: 'money', total: true }],
      table: growthTable(g, 'compound-interest.csv', !!v.inflation),
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="compound"]'); if (el) mount(el, config); }
