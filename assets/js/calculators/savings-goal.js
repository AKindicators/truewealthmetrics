import { timeToGoal, requiredMonthly, growth } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=d6431262b6';

const config = {
  slug: 'savings-goal',
  fields: [
    { id: 'mode', label: 'What do you want to work out?', type: 'choice', default: 'time', options: [['time', 'How long it will take'], ['required', 'How much to save each month']] },
    { id: 'goal', label: 'Savings goal', type: 'money', default: 20000, min: 1, max: 100000000 },
    { id: 'current', label: 'Already saved', type: 'money', default: 2000, min: 0, max: 100000000, optional: true },
    { id: 'monthly', label: 'Monthly saving', type: 'money', default: 500, min: 0, max: 10000000, showIf: (v) => v.mode !== 'required' },
    { id: 'years', label: 'Deadline: years', type: 'int', default: 5, min: 0, max: 60, showIf: (v) => v.mode === 'required' },
    { id: 'months', label: 'Deadline: extra months', type: 'int', default: 0, min: 0, max: 11, showIf: (v) => v.mode === 'required' },
    { id: 'rate', label: 'Interest rate (per year)', type: 'percent', unit: '%', default: 4, min: -20, max: 30, help: 'Annual rate, compounded monthly. Use 0% for cash with no interest. Savings rates change over time.' },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  validate(v) {
    if (v.mode === 'required' && v.years * 12 + v.months < 1) return { years: 'Set a deadline of at least 1 month.' };
    if (v.mode !== 'required' && v.monthly <= 0 && v.rate <= 0 && v.current < v.goal) return { monthly: 'With no monthly saving and no interest, the goal can never be reached. Enter a monthly amount.' };
    return {};
  },
  assumptions(v, f) {
    return [
      `Interest at ${v.rate}% a year, compounded monthly, with the rate unchanged throughout.`,
      v.mode === 'required' ? 'The same amount is saved at the end of every month until the deadline.' : `${f.money(v.monthly)} is saved at the end of every month.`,
      'No withdrawals, tax on interest, or account fees.',
    ];
  },
  compute(v, f) {
    const warnings = [];
    if (v.rate > 8) warnings.push('Cash savings rarely pay this much for long. If this money is invested instead, returns can be negative in some years.');
    if (v.mode === 'required') {
      const months = v.years * 12 + v.months;
      const r = requiredMonthly({ goal: v.goal, current: v.current, annualRatePct: v.rate, months });
      const g = growth({ initial: v.current, monthly: r.monthly, annualRatePct: v.rate, years: months / 12 });
      return {
        kpis: [
          { key: 'monthly', label: 'Save each month', value: r.monthly, format: 'money', primary: true, sub: `To reach ${f.money(v.goal)} in ${f.months(months)}` },
          { key: 'contrib', label: 'Total you pay in', value: r.totalContributions, format: 'money' },
          { key: 'interest', label: 'Interest earned', value: r.interest, format: 'money' },
          { key: 'months', label: 'Deadline', value: months, format: 'months' },
        ],
        summary: r.monthly === 0
          ? `Your current savings of ${f.money(v.current)} should grow to the goal by the deadline without adding more.`
          : `To reach <strong>${f.money(v.goal)}</strong> in <strong>${f.months(months)}</strong>, save about <strong>${f.money(r.monthly)} a month</strong>. Interest would contribute roughly ${f.money(r.interest)}.`,
        warnings,
        chart: chartOf(g, f),
        breakdown: [{ label: 'Already saved', value: v.current, format: 'money' }, { label: 'Monthly savings', value: r.totalContributions, format: 'money' }, { label: 'Interest', value: r.interest, format: 'money' }, { label: 'Goal', value: v.goal, format: 'money', total: true }],
        table: tableOf(g),
      };
    }
    const t = timeToGoal({ goal: v.goal, current: v.current, monthly: v.monthly, annualRatePct: v.rate, maxYears: 100 });
    if (t.already) {
      return { kpis: [{ key: 'months', label: 'Time to goal', value: 0, format: 'months', primary: true, tone: 'good', sub: 'You have already reached it' }], summary: `You already have ${f.money(v.current)}, which meets your goal of ${f.money(v.goal)}.`, warnings };
    }
    if (!t.reached) {
      return { kpis: [{ key: 'months', label: 'Time to goal', value: Infinity, format: 'months', primary: true, tone: 'bad', sub: 'Not reached within 100 years' }, { key: 'balance', label: 'Balance after 100 years', value: t.balance, format: 'money' }], summary: 'At this rate the goal is not reached within 100 years. Increase the monthly amount or lower the goal.', warnings };
    }
    const g = growth({ initial: v.current, monthly: v.monthly, annualRatePct: v.rate, years: t.months / 12 });
    return {
      kpis: [
        { key: 'months', label: 'Time to reach your goal', value: t.months, format: 'months', primary: true, sub: `Saving ${f.money(v.monthly)} a month` },
        { key: 'contrib', label: 'Total you pay in', value: t.totalContributions, format: 'money', sub: `On top of the ${f.money(v.current)} already saved` },
        { key: 'interest', label: 'Interest earned', value: t.interest, format: 'money' },
        { key: 'balance', label: 'Balance at that point', value: t.balance, format: 'money' },
      ],
      summary: `Saving <strong>${f.money(v.monthly)} a month</strong> at ${v.rate}%, you reach <strong>${f.money(v.goal)}</strong> in about <strong>${f.months(t.months)}</strong>. Interest contributes ${f.money(t.interest)} of that.`,
      warnings,
      chart: chartOf(g, f),
      breakdown: [{ label: 'Already saved', value: v.current, format: 'money' }, { label: 'Monthly savings', value: t.totalContributions, format: 'money' }, { label: 'Interest', value: t.interest, format: 'money' }, { label: 'Balance', value: t.balance, format: 'money', total: true }],
      table: tableOf(g),
    };
  },
};

function chartOf(g) {
  const rows = g.yearly;
  return { type: 'area', title: 'How your savings build up', desc: 'Money paid in and interest earned, by year.', labels: rows.map((r) => `Yr ${Math.ceil(r.year)}`), series: [{ name: 'Paid in', values: rows.map((r) => r.totalContributions), tone: 1 }, { name: 'Interest', values: rows.map((r) => r.balance - r.totalContributions), tone: 2 }], xTitle: 'Year' };
}
function tableOf(g) {
  return { title: 'Year-by-year savings', csv: 'savings-goal.csv', columns: [{ label: 'Year', key: 'yr', format: 'text' }, { label: 'Paid in this year', key: 'contributions', format: 'money' }, { label: 'Interest this year', key: 'growth', format: 'money' }, { label: 'Balance', key: 'balance', format: 'money' }], rows: g.yearly.map((r) => ({ ...r, yr: Number.isInteger(r.year) ? String(r.year) : r.year.toFixed(2) })) };
}

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="savings-goal"]'); if (el) mount(el, config); }
