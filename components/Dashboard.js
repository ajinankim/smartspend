'use client';
import { useMemo, useState } from 'react';
import { CATEGORY_COLORS } from '../lib/categories';
import {
  withCategory, monthlyTotals, categoryTotals, monthlyByCategory,
  predictNext, insights, monthlyAverage, months, dateRange,
} from '../lib/analysis';
import EChart from './EChart';

export default function Dashboard({ expenses }) {
  const [brand, setBrand] = useState('전체');
  const [range, setRange] = useState('전체');

  const data = useMemo(() => withCategory(expenses), [expenses]);
  const allMonths = useMemo(() => months(data), [data]);
  const rangeStart = useMemo(() => {
    if (range === '전체') return null;
    if (range.startsWith('6')) return allMonths[Math.max(0, allMonths.length - 6)];
    if (range.startsWith('12')) return allMonths[Math.max(0, allMonths.length - 12)];
    return range; // 특정 년도
  }, [range, allMonths]);

  const filtered = useMemo(() => {
    let f = brand === '전체' ? data : data.filter((t) => t.brand === brand);
    if (rangeStart) f = f.filter((t) => t.date.slice(0, 7) >= rangeStart);
    return f;
  }, [data, brand, rangeStart]);

  const mt = useMemo(() => monthlyTotals(filtered), [filtered]);
  const cats = useMemo(() => categoryTotals(filtered), [filtered]);
  const catTrend = useMemo(() => monthlyByCategory(filtered), [filtered]);
  const pred = useMemo(() => predictNext(mt), [mt]);
  const insightList = useMemo(() => insights(filtered, mt), [filtered, mt]);
  const avg = useMemo(() => monthlyAverage(filtered), [filtered]);
  const rangeInfo = useMemo(() => dateRange(filtered), [filtered]);

  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const brands = useMemo(() => ['전체', ...new Set(data.map((t) => t.brand))], [data]);

  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: ₩{c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    color: cats.map((c) => CATEGORY_COLORS[c.name]),
    series: [{
      type: 'pie', radius: ['40%', '68%'], center: ['50%', '46%'],
      itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 1 },
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
      data: cats.map((c) => ({ name: c.name, value: c.total })),
    }],
  }), [cats]);

  const barOption = useMemo(() => ({
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].axisValue}<br/>지출: ₩${p[0].value.toLocaleString()}` },
    grid: { left: 10, right: 10, top: 10, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: mt.map((m) => m.label), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v) => `${v >= 10000 ? (v / 10000).toFixed(1) + '만' : v}` } },
    series: [{ type: 'bar', data: mt.map((m) => m.total), itemStyle: { color: '#4e79a7', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28 }],
  }), [mt]);

  const lineOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 10 } },
    grid: { left: 10, right: 10, top: 10, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: catTrend.months, axisLabel: { fontSize: 9 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v) => `${v >= 10000 ? (v / 10000).toFixed(0) + '만' : v}` } },
    series: catTrend.series
      .filter((s) => s.data.some((v) => v > 0))
      .map((s) => ({ name: s.name, type: 'line', smooth: true, data: s.data, showSymbol: false, lineStyle: { width: 2 }, itemStyle: { color: CATEGORY_COLORS[s.name] } })),
  }), [catTrend]);

  // 예측 차트 (막대 + 예측점)
  const predOption = useMemo(() => {
    const labels = [...mt.map((m) => m.label), '다음달(예측)'];
    const vals = [...mt.map((m) => m.total), pred.predicted];
    return {
      tooltip: { trigger: 'axis', formatter: (p) => `${p[0].axisValue}<br/>₩${p[0].value.toLocaleString()}` },
      grid: { left: 10, right: 10, top: 10, bottom: 0, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 9 } },
      yAxis: { type: 'value', axisLabel: { formatter: (v) => `${v >= 10000 ? (v / 10000).toFixed(1) + '만' : v}` } },
      series: [{
        type: 'bar', data: vals, barMaxWidth: 26,
        itemStyle: { color: (p) => (p.dataIndex === vals.length - 1 ? '#f28e2b' : '#4e79a7'), borderRadius: [4, 4, 0, 0] },
      }],
    };
  }, [mt, pred]);

  return (
    <div className="dash">
      <header className="topbar">
        <span className="brand">💸 SmartSpend</span>
        <div className="filters">
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="전체">전체 기간</option>
            <option value="6">최근 6개월</option>
            <option value="12">최근 12개월</option>
            {[...new Set(allMonths.map((m) => m.slice(0, 4)))].sort().map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
      </header>

      {rangeInfo && <div className="period">{rangeInfo.min} ~ {rangeInfo.max} · {filtered.length}건</div>}

      <div className="summary">
        <div className="card"><div className="lbl">총 지출</div><div className="val">₩{total.toLocaleString()}</div></div>
        <div className="card"><div className="lbl">월평균</div><div className="val">₩{avg.toLocaleString()}</div></div>
        <div className="card"><div className="lbl">이번 달</div><div className="val">₩{(mt.length ? mt[mt.length - 1].total : 0).toLocaleString()}</div></div>
        <div className="card accent"><div className="lbl">다음 달 예상</div><div className="val">₩{pred.predicted.toLocaleString()}</div>
          <div className={pred.rate >= 0 ? 'rate up' : 'rate down'}>{pred.rate >= 0 ? '▲' : '▼'} {Math.abs(pred.rate).toFixed(1)}%</div>
        </div>
      </div>

      {insightList.length > 0 && (
        <div className="insights">
          {insightList.map((ins, i) => (
            <div key={i} className={`insight ${ins.type}`}>{ins.text}</div>
          ))}
        </div>
      )}

      <div className="grid">
        <div className="panel"><h3>카테고리별 지출</h3><EChart option={pieOption} height={300} /></div>
        <div className="panel"><h3>월별 지출 추이</h3><EChart option={barOption} height={300} /></div>
        <div className="panel wide"><h3>다음 달 예측</h3><EChart option={predOption} height={280} /></div>
        <div className="panel wide"><h3>카테고리별 추이</h3><EChart option={lineOption} height={320} /></div>
      </div>

      <div className="panel">
        <h3>최근 거래</h3>
        <table className="tx-table">
          <thead><tr><th>날짜</th><th>카드</th><th>가맹점</th><th>카테고리</th><th>금액</th></tr></thead>
          <tbody>
            {filtered.slice(-30).reverse().map((t, i) => (
              <tr key={i}>
                <td>{t.date}</td><td>{t.brand}</td><td>{t.merchant}</td>
                <td><span className="badge" style={{ background: CATEGORY_COLORS[t.category] }}>{t.category}</span></td>
                <td className="amt">₩{t.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}