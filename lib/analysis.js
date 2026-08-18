import { classify, CATEGORIES } from './categories';

// 모든 거래에 카테고리 부여
export function withCategory(expenses) {
  return expenses.map((t) => ({ ...t, category: classify(t.merchant) }));
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${y}.${m}`;
}

// 월별 총지출
export function monthlyTotals(expenses) {
  const map = {};
  for (const t of expenses) {
    const k = monthKey(t.date);
    map[k] = (map[k] || 0) + t.amount;
  }
  return Object.keys(map).sort().map((k) => ({ month: k, label: monthLabel(k), total: map[k] }));
}

// 카테고리별 총지출 (필터 가능: 기간)
export function categoryTotals(expenses, fromMonth, toMonth) {
  const map = {};
  for (const t of expenses) {
    const k = monthKey(t.date);
    if (fromMonth && k < fromMonth) continue;
    if (toMonth && k > toMonth) continue;
    map[t.category] = (map[t.category] || 0) + t.amount;
  }
  return Object.entries(map)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

// 월별 × 카테고리 (누적 선 추이용)
export function monthlyByCategory(expenses) {
  const months = [...new Set(expenses.map((t) => monthKey(t.date)))].sort();
  const cats = CATEGORIES.map((c) => c.name);
  const series = cats.map((cat) => ({
    name: cat,
    data: months.map((m) => {
      const f = expenses.filter((t) => monthKey(t.date) === m && t.category === cat);
      return f.reduce((s, t) => s + t.amount, 0);
    }),
  }));
  return { months: months.map(monthLabel), series };
}

// 거래 기간 범위
export function dateRange(expenses) {
  const ms = months(expenses);
  return ms.length ? { min: ms[0], max: ms[ms.length - 1] } : null;
}

export function months(expenses) {
  return [...new Set(expenses.map((t) => monthKey(t.date)))].sort();
}

// ---- 예측: 이동평균 + 선형추세 결합 ----
function linearRegression(ys) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0 };
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den ? num / den : 0;
  return { slope, intercept: my - slope * mx };
}

// 다음 달 예측 (최근 6개월 이동평균 + 선형추세 가중)
export function predictNext(monthly, k = 6) {
  const vals = monthly.slice(-k).map((m) => m.total);
  const { slope, intercept } = linearRegression(vals);
  const trendNext = intercept + slope * (vals.length);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const n = vals.length;
  const trendWeight = Math.min(0.6, 0.3 + n * 0.05);
  const pred = avg * (1 - trendWeight) + trendNext * trendWeight;
  // rate: 직전 3개월 평균 대비 (마지막 부분월 왜곡 방지)
  const baseAvg = vals.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, vals.slice(-3).length);
  const rate = baseAvg > 0 ? ((pred - baseAvg) / baseAvg) * 100 : 0;
  return { predicted: Math.round(pred), rate, trendNext: Math.round(trendNext), avg: Math.round(avg) };
}

// 소비 패턴 인사이트
export function insights(expenses, monthly) {
  const out = [];
  if (monthly.length < 2) return out;
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  if (prev && prev.total > 0) {
    const d = ((last.total - prev.total) / prev.total) * 100;
    out.push({ type: d >= 0 ? 'up' : 'down', text: `이번 달(${last.label}) 지출은 전월 대비 ${Math.abs(d).toFixed(1)}% ${d >= 0 ? '증가' : '감소'}했어요.` });
  }
  // 최다 카테고리
  const cats = categoryTotals(expenses);
  if (cats.length) {
    out.push({ type: 'info', text: `가장 지출이 많은 카테고리는 ${cats[0].name}(으)로 ${cats[0].total.toLocaleString()}원이에요.` });
  }
  // 일평균
  const days = (new Date(last.month + '-28') - new Date(`${last.month}-01`)) / 86400000 + 1;
  const daily = last.total / days;
  out.push({ type: 'info', text: `이번 달 일평균 지출은 약 ${Math.round(daily).toLocaleString()}원이에요.` });
  return out;
}

// 월평균 (맨 마지막 달은 부분월이므로 제외)
export function monthlyAverage(expenses) {
  const mt = monthlyTotals(expenses);
  if (!mt.length) return 0;
  const full = mt.slice(0, -1);
  if (!full.length) return 0;
  return Math.round(full.reduce((s, m) => s + m.total, 0) / full.length);
}