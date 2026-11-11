/*!
 * TrueWealthMetrics calculation core — pure functions, no DOM, no network.
 * Every calculator on the site uses these functions so that the same inputs
 * always produce the same answer. Conventions (documented on /calculator-methodology/):
 *
 *  Loans, mortgages, cards:  monthly rate = annual rate ÷ 12 (nominal). Payments at month end.
 *  Growth (savings/investing): nominal annual rate compounded n times a year; the
 *      equivalent monthly growth factor is (1 + r/n)^(n/12). Default n = 12.
 *      Monthly contributions are added at the END of each month unless timing = 'start'.
 *  Fees: annual fee % charged monthly as (fee ÷ 12) of the balance after growth.
 *  Inflation: real value = nominal value ÷ (1 + inflation)^years.
 *  No intermediate rounding: values are rounded only for display.
 */

export const MAX_MONTHS = 1200; // 100-year safety cap for iterative schedules

const finite = (x) => typeof x === 'number' && Number.isFinite(x);

/* ------------------------------------------------------------------ loans */

/** Level monthly payment for a fully amortising loan. */
export function loanPayment(principal, annualRatePct, months) {
  if (!(principal > 0) || !(months > 0)) return 0;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

/**
 * Amortisation schedule with an optional fixed extra monthly payment.
 * Returns the contractual payment, a month-by-month schedule and totals.
 */
export function amortize({ principal, annualRatePct, months, extraMonthly = 0 }) {
  const payment = loanPayment(principal, annualRatePct, months);
  const i = annualRatePct / 100 / 12;
  const schedule = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  let m = 0;
  while (balance > 1e-7 && m < MAX_MONTHS) {
    m++;
    const interest = balance * i;
    const due = balance + interest;
    const scheduled = Math.min(payment, due);
    const extra = Math.min(Math.max(0, extraMonthly), due - scheduled);
    const paid = scheduled + extra;
    balance = due - paid;
    if (balance < 1e-7) balance = 0;
    totalInterest += interest;
    totalPaid += paid;
    schedule.push({ month: m, payment: paid, interest, principal: paid - interest, extra, balance });
  }
  return { payment, schedule, months: m, totalInterest, totalPaid };
}

/* ------------------------------------------------------------ credit card */

/**
 * Credit card payoff. paymentType 'fixed': pays fixedPayment + extra each month.
 * paymentType 'percent': pays max(floor, percent% of the current balance) + extra.
 * Interest is approximated monthly at APR ÷ 12 (card issuers usually accrue daily).
 */
export function cardPayoff({ balance, aprPct, paymentType = 'fixed', fixedPayment = 0, percent = 3, floor = 25, extra = 0 }) {
  const i = aprPct / 100 / 12;
  const schedule = [];
  let b = balance;
  let totalInterest = 0;
  let totalPaid = 0;
  let m = 0;
  const firstInterest = b * i;
  const firstPayment = paymentType === 'percent' ? Math.max(floor, (b * percent) / 100) + extra : fixedPayment + extra;
  if (b > 0 && firstPayment <= firstInterest) {
    return { never: true, months: Infinity, totalInterest: Infinity, totalPaid: Infinity, schedule, firstPayment, firstInterest };
  }
  while (b > 1e-7 && m < MAX_MONTHS) {
    m++;
    const interest = b * i;
    const due = b + interest;
    const base = paymentType === 'percent' ? Math.max(floor, (b * percent) / 100) : fixedPayment;
    const paid = Math.min(base + extra, due);
    b = due - paid;
    if (b < 1e-7) b = 0;
    totalInterest += interest;
    totalPaid += paid;
    schedule.push({ month: m, payment: paid, interest, balance: b });
  }
  const capped = b > 0;
  return { never: capped, capped, months: capped ? Infinity : m, totalInterest, totalPaid, schedule, firstPayment, firstInterest };
}

/* ------------------------------------------------------- multiple debts */

/**
 * Snowball (smallest starting balance first) or avalanche (highest APR first).
 * Each month: interest accrues, every minimum is paid, and whatever is left of
 * the monthly budget goes to the priority debt. Freed-up minimums roll over.
 */
export function debtPayoff(debts, monthlyBudget, method = 'avalanche') {
  const list = debts
    .filter((d) => d.balance > 0)
    .map((d, idx) => ({ ...d, idx, b: d.balance, interest: 0, paidOffMonth: null }));
  const minimums = list.reduce((s, d) => s + Math.min(d.minPayment, d.balance), 0);
  if (!list.length) return { feasible: true, months: 0, totalInterest: 0, totalPaid: 0, debts: [], minimums, timeline: [] };
  if (monthlyBudget < minimums - 1e-9) return { feasible: false, reason: 'budget-below-minimums', minimums };
  const order = [...list].sort(method === 'snowball'
    ? (a, b) => a.balance - b.balance || b.aprPct - a.aprPct
    : (a, b) => b.aprPct - a.aprPct || a.balance - b.balance);
  let m = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  const timeline = [];
  while (list.some((d) => d.b > 1e-7) && m < MAX_MONTHS) {
    m++;
    let available = monthlyBudget;
    for (const d of list) {
      if (d.b <= 1e-7) continue;
      const int = d.b * (d.aprPct / 100 / 12);
      d.b += int; d.interest += int; totalInterest += int;
    }
    for (const d of list) {
      if (d.b <= 1e-7) continue;
      const pay = Math.min(d.minPayment, d.b, available);
      d.b -= pay; available -= pay; totalPaid += pay;
    }
    for (const d of order) {
      if (available <= 1e-9) break;
      if (d.b <= 1e-7) continue;
      const pay = Math.min(d.b, available);
      d.b -= pay; available -= pay; totalPaid += pay;
    }
    for (const d of list) if (d.b <= 1e-7 && d.paidOffMonth === null) { d.b = 0; d.paidOffMonth = m; }
    timeline.push({ month: m, total: list.reduce((s, d) => s + d.b, 0) });
  }
  if (list.some((d) => d.b > 1e-7)) return { feasible: false, reason: 'never', minimums };
  return {
    feasible: true, months: m, totalInterest, totalPaid, minimums, timeline,
    debts: order.map((d) => ({ idx: d.idx, name: d.name, balance: d.balance, aprPct: d.aprPct, paidOffMonth: d.paidOffMonth, interest: d.interest })),
  };
}

/* ----------------------------------------------------------------- growth */

/** Monthly growth factor for a nominal annual rate compounded n times a year. */
export function monthlyFactor(annualRatePct, compoundsPerYear = 12) {
  const r = annualRatePct / 100;
  return Math.pow(1 + r / compoundsPerYear, compoundsPerYear / 12);
}

/**
 * Generic growth projection used by the compound interest, investment, fee,
 * ROI, savings and retirement calculators.
 */
export function growth({ initial = 0, monthly = 0, annualRatePct = 0, compoundsPerYear = 12, timing = 'end', years = 0, annualFeePct = 0, inflationPct = 0 }) {
  const months = Math.round(years * 12);
  const g = monthlyFactor(annualRatePct, compoundsPerYear);
  const fee = annualFeePct / 100 / 12;
  let b = initial;
  let contrib = initial;
  let totalGrowth = 0;
  let totalFees = 0;
  const yearly = [];
  let yContrib = 0, yGrowth = 0, yFees = 0;
  for (let m = 1; m <= months; m++) {
    if (timing === 'start') { b += monthly; contrib += monthly; yContrib += monthly; }
    const gr = b * (g - 1);
    b += gr; totalGrowth += gr; yGrowth += gr;
    if (fee) { const f = b * fee; b -= f; totalFees += f; yFees += f; }
    if (timing !== 'start') { b += monthly; contrib += monthly; yContrib += monthly; }
    if (m % 12 === 0 || m === months) {
      const yr = m / 12;
      yearly.push({ year: yr, contributions: yContrib, growth: yGrowth, fees: yFees, balance: b, totalContributions: contrib, real: b / Math.pow(1 + inflationPct / 100, yr) });
      yContrib = 0; yGrowth = 0; yFees = 0;
    }
  }
  const real = b / Math.pow(1 + inflationPct / 100, months / 12);
  return { final: b, totalContributions: contrib, totalGrowth, totalFees, real, months, yearly };
}

/* ---------------------------------------------------------------- savings */

/** Months needed to reach a goal, simulated with end-of-month deposits. */
export function timeToGoal({ goal, current = 0, monthly = 0, annualRatePct = 0, maxYears = 60 }) {
  const g = monthlyFactor(annualRatePct, 12);
  if (current >= goal) return { reached: true, months: 0, balance: current, totalContributions: 0, interest: 0, already: true, path: [] };
  let b = current, m = 0, contrib = 0, interest = 0;
  const path = [];
  const cap = Math.min(MAX_MONTHS, Math.round(maxYears * 12));
  while (b < goal - 1e-9 && m < cap) {
    m++;
    const int = b * (g - 1);
    b += int + monthly; interest += int; contrib += monthly;
    if (m % 12 === 0) path.push({ year: m / 12, balance: b });
  }
  if (b < goal - 1e-9) return { reached: false, months: m, balance: b, totalContributions: contrib, interest, path };
  return { reached: true, months: m, balance: b, totalContributions: contrib, interest, path };
}

/** Level end-of-month deposit needed to reach a goal in n months. */
export function requiredMonthly({ goal, current = 0, annualRatePct = 0, months }) {
  const n = Math.max(1, Math.round(months));
  const i = monthlyFactor(annualRatePct, 12) - 1;
  const grownCurrent = current * Math.pow(1 + i, n);
  const shortfall = goal - grownCurrent;
  if (shortfall <= 0) return { monthly: 0, months: n, totalContributions: 0, interest: grownCurrent - current, final: grownCurrent };
  const monthly = i === 0 ? shortfall / n : (shortfall * i) / (Math.pow(1 + i, n) - 1);
  const totalContributions = monthly * n;
  return { monthly, months: n, totalContributions, interest: goal - current - totalContributions, final: goal };
}

/* ------------------------------------------------------------- retirement */

export function retirementPlan({ currentAge, retireAge, currentSavings = 0, monthly = 0, annualReturnPct = 0, inflationPct = 0, targetIncome = 0, otherIncome = 0, withdrawalRatePct = 4, annualFeePct = 0 }) {
  const years = retireAge - currentAge;
  const base = { initial: currentSavings, annualRatePct: annualReturnPct, years, annualFeePct, inflationPct };
  const proj = growth({ ...base, monthly });
  const fromSavings = growth({ ...base, monthly: 0 }).final;
  const perPound = growth({ ...base, initial: 0, monthly: 1 }).final;
  const inflator = Math.pow(1 + inflationPct / 100, years);
  const incomeNeededToday = Math.max(0, targetIncome - otherIncome);
  const incomeNeededAtRetirement = incomeNeededToday * inflator;
  const nestEgg = incomeNeededAtRetirement / (withdrawalRatePct / 100);
  const requiredMonthlyContribution = perPound > 0 ? Math.max(0, (nestEgg - fromSavings) / perPound) : 0;
  const sustainableIncomeToday = (proj.final * withdrawalRatePct / 100) / inflator + otherIncome;
  return {
    years, pot: proj.final, potReal: proj.final / inflator, nestEgg, nestEggReal: nestEgg / inflator,
    gap: nestEgg - proj.final, onTrack: proj.final >= nestEgg, requiredMonthly: requiredMonthlyContribution,
    incomeNeededAtRetirement, sustainableIncomeToday, totalContributions: proj.totalContributions, yearly: proj.yearly,
  };
}

/* -------------------------------------------------------------------- ROI */

/** Simple ROI and CAGR from a single amount invested and a final value. */
export function roiSimple({ invested, finalValue, years }) {
  const profit = finalValue - invested;
  const roi = invested > 0 ? profit / invested : NaN;
  const cagr = invested > 0 && years > 0 && finalValue >= 0 ? Math.pow(finalValue / invested, 1 / years) - 1 : NaN;
  return { profit, roi, cagr };
}

/**
 * Money-weighted annualised return (IRR) for an initial amount plus level
 * monthly contributions that grow to `final` after `months`. Solved by bisection
 * on the monthly rate; returned as an effective annual rate.
 */
export function annualisedReturn({ initial, monthly = 0, months, final, timing = 'end' }) {
  if (!(months > 0) || initial + monthly * months <= 0) return NaN;
  const fv = (r) => {
    let b = initial;
    for (let k = 0; k < months; k++) {
      if (timing === 'start') b += monthly;
      b *= 1 + r;
      if (timing !== 'start') b += monthly;
    }
    return b;
  };
  let lo = -0.9999, hi = 1;
  if (fv(lo) > final || fv(hi) < final) return NaN;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (fv(mid) > final) hi = mid; else lo = mid;
  }
  return Math.pow(1 + (lo + hi) / 2, 12) - 1;
}

/* ----------------------------------------------------------------- budget */

export const BUDGET_ESSENTIAL = ['housing', 'utilities', 'transport', 'groceries', 'insurance', 'debt', 'otherFixed'];
export const BUDGET_FLEXIBLE = ['subscriptions', 'variable'];

export function budget(v) {
  const sum = (keys) => keys.reduce((s, k) => s + (finite(v[k]) ? v[k] : 0), 0);
  const essentials = sum(BUDGET_ESSENTIAL);
  const flexible = sum(BUDGET_FLEXIBLE);
  const expenses = essentials + flexible;
  const income = v.income || 0;
  const leftover = income - expenses;
  const savingsTarget = (income * (v.savingsPct || 0)) / 100;
  const emergencyTarget = essentials * (v.emergencyMonths || 0);
  const pct = (x) => (income > 0 ? x / income : NaN);
  return {
    income, essentials, flexible, expenses, leftover, savingsTarget, emergencyTarget,
    canSave: Math.max(0, leftover), meetsTarget: leftover >= savingsTarget,
    shares: { needs: pct(essentials), wants: pct(flexible), savings: pct(Math.max(0, leftover)) },
  };
}
