import { retirementPlan } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=a49c19ca5a';
import { returnWarnings } from './growth-shared.js?v=d7424a2b3f';

const config = {
  slug: 'retirement',
  fields: [
    { id: 'currentAge', label: 'Your age now', type: 'int', default: 30, min: 16, max: 90 },
    { id: 'retireAge', label: 'Age you want to retire', type: 'int', default: 65, min: 17, max: 100 },
    { id: 'savings', label: 'Retirement savings so far', type: 'money', default: 20000, min: 0, max: 100000000, optional: true },
    { id: 'monthly', label: 'Monthly contribution', type: 'money', default: 300, min: 0, max: 10000000, optional: true, help: 'Include any employer contributions or tax relief that go into your pension.' },
    { id: 'rate', label: 'Expected return (per year)', type: 'percent', unit: '%', default: 5, min: -20, max: 20, help: 'Before inflation. A cautious assumption is safer for a long-term plan.' },
    { id: 'inflation', label: 'Inflation (per year)', type: 'percent', unit: '%', default: 2.5, min: -5, max: 20 },
    { id: 'income', label: 'Retirement income you want (per year, today’s money)', type: 'money', default: 30000, min: 0, max: 10000000 },
    { id: 'other', label: 'Other retirement income (per year, today’s money)', type: 'money', default: 0, min: 0, max: 10000000, optional: true, help: 'For example a state pension or a defined-benefit pension. Check your own entitlement; this calculator does not estimate it.' },
    { id: 'wr', label: 'Withdrawal rate', type: 'percent', unit: '%', default: 4, min: 1, max: 10, help: 'The % of your pot you plan to take each year. Lower rates are more likely to last.' },
    { id: 'fee', label: 'Annual fees', type: 'percent', unit: '%', default: 0, min: 0, max: 5, optional: true, group: 'Advanced' },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  validate(v) {
    if (v.retireAge <= v.currentAge) return { retireAge: 'Your retirement age must be later than your current age.' };
    return {};
  },
  assumptions(v, f) {
    return [
      `${v.retireAge - v.currentAge} years of saving, with a steady ${v.rate}% a year return${v.fee ? ` less ${v.fee}% fees` : ''}, compounded monthly.`,
      `Contributions of ${f.money(v.monthly)} a month stay the same in cash terms (they are not increased with pay or inflation).`,
      `Target pot = income needed from savings ÷ ${v.wr}% withdrawal rate, with income inflated at ${v.inflation}% a year.`,
      'No tax on contributions, growth or withdrawals. Pension tax rules differ by country and change over time.',
    ];
  },
  compute(v, f) {
    const p = retirementPlan({ currentAge: v.currentAge, retireAge: v.retireAge, currentSavings: v.savings, monthly: v.monthly, annualReturnPct: v.rate, inflationPct: v.inflation, targetIncome: v.income, otherIncome: v.other, withdrawalRatePct: v.wr, annualFeePct: v.fee });
    const warnings = returnWarnings(v.rate);
    if (v.wr > 5) warnings.push(`A ${v.wr}% withdrawal rate carries a higher risk of running out of money, especially in a long retirement.`);
    const shortfall = Math.max(0, p.gap);
    return {
      kpis: [
        { key: 'pot', label: `Projected pot at ${v.retireAge}`, value: p.pot, format: 'money0', primary: true, tone: p.onTrack ? 'good' : 'warn', sub: `${f.money0(p.potReal)} in today’s money` },
        { key: 'target', label: 'Target pot', value: p.nestEgg, format: 'money0', sub: `${f.money0(p.nestEggReal)} in today’s money` },
        { key: 'monthly', label: 'Monthly saving needed', value: p.requiredMonthly, format: 'money0', sub: p.onTrack ? 'You are already saving enough' : `You save ${f.money0(v.monthly)} now` },
        { key: 'income', label: 'Sustainable income (today’s money)', value: p.sustainableIncomeToday, format: 'money0', sub: `Per year, including other income, at ${v.wr}% withdrawals` },
      ],
      summary: p.onTrack
        ? `On these assumptions you are <strong>on track</strong>: your pot could reach ${f.money0(p.pot)} by ${v.retireAge}, above the ${f.money0(p.nestEgg)} target.`
        : `On these assumptions your pot could reach <strong>${f.money0(p.pot)}</strong> by ${v.retireAge}, which is <strong>${f.money0(shortfall)} short</strong> of the ${f.money0(p.nestEgg)} target. Saving about <strong>${f.money0(p.requiredMonthly)} a month</strong> would close the gap, or you could retire later or aim for a lower income.`,
      warnings,
      chart: { type: 'area', title: 'Projected retirement savings', desc: 'Money paid in and investment growth by age.', xTitle: 'Age', labels: p.yearly.map((r) => String(v.currentAge + r.year)), series: [{ name: 'Paid in', values: p.yearly.map((r) => r.totalContributions), tone: 1 }, { name: 'Growth', values: p.yearly.map((r) => Math.max(0, r.balance - r.totalContributions)), tone: 2 }] },
      breakdown: [
        { label: 'Income wanted (today’s money)', value: v.income, format: 'money0' },
        { label: 'Less other income', value: -v.other, format: 'money0' },
        { label: `Needed from savings at ${v.retireAge} (inflated)`, value: p.incomeNeededAtRetirement, format: 'money0' },
        { label: `÷ ${v.wr}% withdrawal rate = target pot`, value: p.nestEgg, format: 'money0', total: true },
        { label: 'Projected pot', value: p.pot, format: 'money0' },
        { label: p.onTrack ? 'Surplus' : 'Shortfall', value: Math.abs(p.gap), format: 'money0', total: true },
      ],
      table: { title: 'Year-by-year projection', csv: 'retirement-projection.csv', columns: [{ label: 'Age', key: 'age', format: 'int' }, { label: 'Paid in this year', key: 'contributions', format: 'money0' }, { label: 'Growth this year', key: 'growth', format: 'money0' }, { label: 'Balance', key: 'balance', format: 'money0' }, { label: 'In today’s money', key: 'real', format: 'money0' }], rows: p.yearly.map((r) => ({ ...r, age: v.currentAge + r.year })) },
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="retirement"]'); if (el) mount(el, config); }
