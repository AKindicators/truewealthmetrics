import { budget } from '../calc-core.js?v=98c18a5445';
import { mount, currencyOptions } from '../calc-ui.js?v=a0568ddf45';

const E = 'Essential costs (per month)';
const W = 'Flexible spending (per month)';
const money = (id, label, def, group, help) => ({ id, label, type: 'money', default: def, min: 0, max: 10000000, optional: true, group, openGroup: true, help });

const config = {
  slug: 'budget',
  fields: [
    { id: 'income', label: 'Monthly take-home pay', type: 'money', default: 3000, min: 0, max: 10000000, help: 'What actually reaches your account after tax and deductions.' },
    money('housing', 'Rent or mortgage', 1100, E),
    money('utilities', 'Energy, water, phone and internet', 180, E),
    money('transport', 'Transport', 200, E),
    money('groceries', 'Groceries', 350, E),
    money('insurance', 'Insurance', 120, E),
    money('debt', 'Minimum debt repayments', 150, E),
    money('otherFixed', 'Other essential bills', 80, E, 'For example council tax, childcare or prescriptions.'),
    money('subscriptions', 'Subscriptions', 45, W),
    money('variable', 'Eating out, shopping and leisure', 300, W),
    { id: 'savingsPct', label: 'Savings target (% of take-home pay)', type: 'percent', unit: '%', default: 20, min: 0, max: 100, group: 'Goals', openGroup: true },
    { id: 'emergencyMonths', label: 'Emergency fund target (months of essentials)', type: 'number', default: 3, min: 0, max: 24, group: 'Goals' },
    { id: 'currency', label: 'Currency', type: 'select', default: 'GBP', options: currencyOptions },
  ],
  assumptions(v, f) {
    return [
      'All figures are monthly. Spread annual bills by dividing them by 12.',
      '"Needs" are the essential costs (including minimum debt payments). "Wants" are subscriptions and flexible spending.',
      `The 50/30/20 split is a common rule of thumb, not a requirement. Your savings target here is ${v.savingsPct}%.`,
    ];
  },
  compute(v, f) {
    const b = budget(v);
    const deficit = b.leftover < 0;
    const warnings = [];
    if (deficit) warnings.push(`You are spending <strong>${f.money(-b.leftover)}</strong> more than you earn each month. Over time that gap usually becomes debt. Look first at the biggest flexible items.`);
    const status = deficit ? 'bad' : b.meetsTarget ? 'good' : 'warn';
    const summary = deficit
      ? `Your costs of <strong>${f.money(b.expenses)}</strong> exceed your take-home pay of <strong>${f.money(b.income)}</strong>.`
      : b.meetsTarget
        ? `You have <strong>${f.money(b.leftover)}</strong> left each month, which covers your <strong>${f.money(b.savingsTarget)}</strong> savings target with ${f.money(b.leftover - b.savingsTarget)} to spare.`
        : `You have <strong>${f.money(b.leftover)}</strong> left each month, which is <strong>${f.money(b.savingsTarget - b.leftover)}</strong> short of your ${v.savingsPct}% savings target. Trimming flexible spending is usually the quickest fix.`;
    return {
      kpis: [
        { key: 'leftover', label: 'Left over each month', value: b.leftover, format: 'money', primary: true, tone: status, sub: 'Take-home pay minus all costs' },
        { key: 'expenses', label: 'Total monthly costs', value: b.expenses, format: 'money', sub: `${f.money(b.essentials)} essential · ${f.money(b.flexible)} flexible` },
        { key: 'target', label: 'Savings target', value: b.savingsTarget, format: 'money', sub: `${v.savingsPct}% of take-home pay` },
        { key: 'emergency', label: 'Emergency fund target', value: b.emergencyTarget, format: 'money', sub: `${v.emergencyMonths} months of essential costs` },
      ],
      summary, warnings,
      chart: b.income > 0 ? { type: 'bars', title: 'Your budget vs the 50/30/20 guide', desc: 'Monthly amounts for needs, wants and savings compared with a 50/30/20 split of take-home pay.', labels: ['Needs', 'Wants', 'Savings'], series: [{ name: 'Your budget', values: [b.essentials, b.flexible, Math.max(0, b.leftover)], tone: 1 }, { name: '50/30/20 guide', values: [b.income * 0.5, b.income * 0.3, b.income * 0.2], tone: 4 }] } : null,
      breakdown: [
        { label: 'Take-home pay', value: b.income, format: 'money' },
        { label: 'Essential costs', value: -b.essentials, format: 'money' },
        { label: 'Flexible spending', value: -b.flexible, format: 'money' },
        { label: 'Left over', value: b.leftover, format: 'money', total: true },
        { label: 'Needs as % of pay', value: b.shares.needs, format: 'pct' },
        { label: 'Wants as % of pay', value: b.shares.wants, format: 'pct' },
        { label: 'Available to save as % of pay', value: b.shares.savings, format: 'pct' },
      ],
    };
  },
};

export default config;
if (typeof document !== 'undefined') { const el = document.querySelector('[data-calc="budget"]'); if (el) mount(el, config); }
