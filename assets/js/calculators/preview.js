// Homepage preview: a compact compound growth estimate using the same engine as the full tools.
import { growth } from '../calc-core.js?v=98c18a5445';
import { mount } from '../calc-ui.js?v=a49c19ca5a';
import { growthChart } from './growth-shared.js?v=d7424a2b3f';

const config = {
  slug: 'preview',
  fields: [
    { id: 'p-start', label: 'Starting amount', type: 'money', default: 1000, min: 0, max: 100000000 },
    { id: 'p-monthly', label: 'Monthly saving', type: 'money', default: 200, min: 0, max: 10000000 },
    { id: 'p-rate', label: 'Annual return', type: 'percent', unit: '%', default: 5, min: -50, max: 50 },
    { id: 'p-years', label: 'Years', type: 'int', default: 20, min: 1, max: 100 },
  ],
  compute(v, f) {
    const g = growth({ initial: v['p-start'], monthly: v['p-monthly'], annualRatePct: v['p-rate'], years: v['p-years'] });
    return {
      kpis: [
        { key: 'final', label: `After ${v['p-years']} years`, value: g.final, format: 'money0', primary: true },
        { key: 'paid', label: 'You pay in', value: g.totalContributions, format: 'money0' },
        { key: 'growth', label: 'Growth', value: g.final - g.totalContributions, format: 'money0' },
      ],
      summary: `Monthly compounding, contributions at month end, no fees or tax. An illustration, not a forecast.`,
      chart: growthChart(g, 'Paid in vs growth'),
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="preview"]'); if (el) mount(el, config); }
