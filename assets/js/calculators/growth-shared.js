// Shared pieces for the growth-based calculators (compound, investment, fees, ROI).
export const freqOptions = [['12', 'Monthly'], ['4', 'Quarterly'], ['2', 'Twice a year'], ['1', 'Yearly'], ['365', 'Daily']];
export const freqName = { 12: 'monthly', 4: 'quarterly', 2: 'twice a year', 1: 'yearly', 365: 'daily' };

export function growthChart(g, title = 'How your money grows') {
  return {
    type: 'area', title, desc: 'Total paid in and growth after fees, by year.', xTitle: 'Year',
    labels: g.yearly.map((r) => `Yr ${Math.ceil(r.year)}`),
    series: [{ name: 'Paid in', values: g.yearly.map((r) => r.totalContributions), tone: 1 }, { name: 'Growth', values: g.yearly.map((r) => Math.max(0, r.balance - r.totalContributions)), tone: 2 }],
  };
}

export function growthTable(g, csv, withReal) {
  const columns = [{ label: 'Year', key: 'year', format: 'int' }, { label: 'Paid in this year', key: 'contributions', format: 'money' }, { label: 'Growth this year', key: 'growth', format: 'money' }];
  if (g.totalFees > 0) columns.push({ label: 'Fees this year', key: 'fees', format: 'money' });
  columns.push({ label: 'Balance', key: 'balance', format: 'money' });
  if (withReal) columns.push({ label: 'In today’s money', key: 'real', format: 'money' });
  return { title: 'Year-by-year growth', csv, columns, rows: g.yearly };
}

export function returnWarnings(rate) {
  const w = [];
  if (rate > 12) w.push(`A ${rate}% average annual return is optimistic for long periods. Try a more cautious rate too: real returns vary a lot and can be negative.`);
  if (rate < 0) w.push('A negative return means the investment loses value each year on average.');
  return w;
}
