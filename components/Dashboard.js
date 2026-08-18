'use client';
import { useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { CATEGORY_COLORS, CATEGORIES } from '../lib/categories';
import { withCategory, monthlyTotals, monthlyAverage } from '../lib/analysis';
import EChart from './EChart';

const DATA_START = '2025-09-01'; // 2025년 9월부터만

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function Dashboard({ expenses, user }) {
  const [brand, setBrand] = useState('전체');
  const [startDate, setStartDate] = useState('2025-09-01');
  const [endDate, setEndDate] = useState('');
  const [selCategory, setSelCategory] = useState('전체');
  const [selMonth, setSelMonth] = useState(null); // 'YYYY-MM' 또는 null
  const [trendType, setTrendType] = useState('bar'); // bar | line
  const [excludedIds, setExcludedIds] = useState(() => new Set());

  const base = useMemo(() => withCategory(expenses)
    .filter((t) => t.date >= DATA_START)
    .map((t, i) => ({ ...t, id: `${t.date}_${t.merchant}_${t.amount}_${t.brand}_${i}` })), [expenses]);
  const maxDate = useMemo(() => (base.length ? [...base.map((t) => t.date)].sort().pop() : ''), [base]);
  const effectiveEnd = endDate || maxDate;

  // 기간 + 브랜드 필터
  const filtered = useMemo(() => {
    let f = base;
    if (startDate) f = f.filter((t) => t.date >= startDate);
    if (effectiveEnd) f = f.filter((t) => t.date <= effectiveEnd);
    if (brand !== '전체') f = f.filter((t) => t.brand === brand);
    return f;
  }, [base, startDate, effectiveEnd, brand]);

  // 막대 클릭 월 → viewData (분석: 제외 항목 제거)
  const analysisFiltered = useMemo(() => filtered.filter((t) => !excludedIds.has(t.id)), [filtered, excludedIds]);
  const viewData = useMemo(() => {
    if (selMonth) return analysisFiltered.filter((t) => t.date.slice(0, 7) === selMonth);
    return analysisFiltered;
  }, [analysisFiltered, selMonth]);

  const brands = useMemo(() => ['전체', ...new Set(base.map((t) => t.brand))], [base]);

  // 집계 (viewData 기준)
  const mt = useMemo(() => monthlyTotals(analysisFiltered), [analysisFiltered]);
  const cats = useMemo(() => {
    const m = {};
    for (const t of viewData) m[t.category] = (m[t.category] || 0) + t.amount;
    return Object.entries(m).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [viewData]);
  const avg = useMemo(() => monthlyAverage(viewData), [viewData]);
  const total = viewData.reduce((s, t) => s + t.amount, 0);
  const top2 = cats.slice(0, 2);

  // 상세 내역: 월 + 카테고리 필터 (제외 항목 포함 표시)
  const detailRows = useMemo(() => {
    let f = filtered;
    if (selMonth) f = f.filter((t) => t.date.slice(0, 7) === selMonth);
    if (selCategory !== '전체') f = f.filter((t) => t.category === selCategory);
    return f;
  }, [filtered, selMonth, selCategory]);

  const toggleExclude = (id) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 도넛 옵션
  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: ₩{c} ({d}%)' },
    color: cats.map((c) => CATEGORY_COLORS[c.name]),
    series: [{
      type: 'pie', radius: ['40%', '68%'], center: ['50%', '50%'],
      itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 1 },
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
      data: cats.map((c) => ({ name: c.name, value: c.total })),
    }],
  }), [cats]);

  // 월별 지출 추이 (막대/선형 전환, 카테고리 선택 시 채워진 선형 + 전체 대비 비중)
  const trendOption = useMemo(() => {
    const mtAll = mt;
    const isBar = trendType === 'bar';
    const allLabels = mtAll.map((x) => x.label);
    const allVals = mtAll.map((m) => m.total);
    const yAxis = { type: 'value', axisLabel: { formatter: (v) => `${v >= 10000 ? (v / 10000).toFixed(1) + '만' : v}` } };
    const grid = { left: 10, right: 10, top: 28, bottom: 0, containLabel: true };
    const catMap = {};
    if (selCategory !== '전체') {
      monthlyTotals(analysisFiltered.filter((t) => t.category === selCategory)).forEach((m) => { catMap[m.month] = m.total; });
    }
    const catVals = allLabels.map((_, i) => catMap[mtAll[i].month] || 0);

    if (isBar) {
      // ---- 막대 차트 ----
      if (selCategory === '전체') {
        const monthTotals = {}, monthCat = {}, monthBrand = {};
        for (const t of analysisFiltered) {
          const m = t.date.slice(0, 7);
          monthTotals[m] = (monthTotals[m] || 0) + t.amount;
          monthCat[m] = monthCat[m] || {};
          monthCat[m][t.category] = (monthCat[m][t.category] || 0) + t.amount;
          monthBrand[m] = monthBrand[m] || {};
          monthBrand[m][t.brand] = (monthBrand[m][t.brand] || 0) + t.amount;
        }
        const tooltipFmt = (p) => {
          const m = p[0].dataIndex;
          const key = mtAll[m].month;
          const tot = monthTotals[key];
          const cat = monthCat[key] || {};
          const br = monthBrand[key] || {};
          let h = `<b>${mtAll[m].label}</b><br/>총액: ₩${tot.toLocaleString()}`;
          h += `<br/><hr style="margin:3px 0"/>`;
          Object.entries(cat).sort((a, b) => b[1] - a[1]).forEach(([c, v]) => {
            h += `<span style="color:#999">${c}</span> ₩${v.toLocaleString()} (${((v / tot) * 100).toFixed(1)}%)<br/>`;
          });
          h += `<hr style="margin:3px 0"/>`;
          Object.entries(br).sort((a, b) => b[1] - a[1]).forEach(([b2, v]) => {
            h += `<span style="color:#999">${b2}카드</span> ₩${v.toLocaleString()} (${((v / tot) * 100).toFixed(1)}%)<br/>`;
          });
          return h;
        };
        return {
          tooltip: { trigger: 'axis', formatter: tooltipFmt, confine: true, extraCssText: 'max-width:280px;word-break:keep-all;' },
          grid,
          xAxis: { type: 'category', data: allLabels, axisLabel: { fontSize: 10 } },
          yAxis,
          series: [{ type: 'bar', data: allVals, barMaxWidth: 28, itemStyle: { color: (p) => (selMonth && mtAll[p.dataIndex].month === selMonth ? '#e15759' : '#4e79a7'), borderRadius: [4, 4, 0, 0] } }],
        };
      }
      // 카테고리 선택 막대
      const catColor = CATEGORY_COLORS[selCategory] || '#f28e2b';
      const tooltipFmt = (p) => {
        const m = p[0].dataIndex;
        const key = mtAll[m].month;
        const catVal = catMap[key] || 0;
        const totVal = allVals[m];
        const pct = totVal > 0 ? ((catVal / totVal) * 100) : 0;
        let h = `<b>${mtAll[m].label}</b>`;
        h += `<br/><span style="color:${catColor}">● ${selCategory}</span> ₩${catVal.toLocaleString()}`;
        h += `<br/>전체 지출: ₩${totVal.toLocaleString()}`;
        h += `<br/><b>비중: ${pct.toFixed(1)}%</b>`;
        return h;
      };
      return {
        tooltip: { trigger: 'axis', formatter: tooltipFmt, confine: true, extraCssText: 'max-width:240px;word-break:keep-all;' },
        grid,
        xAxis: { type: 'category', data: allLabels, axisLabel: { fontSize: 10 } },
        yAxis,
        series: [{ type: 'bar', data: catVals, barMaxWidth: 28, itemStyle: { color: (p) => (selMonth && mtAll[p.dataIndex].month === selMonth ? '#e15759' : catColor), borderRadius: [4, 4, 0, 0] } }],
      };
    }

    // ---- 선형 차트 ----
    const totalColor = '#9aa4b2';
    if (selCategory === '전체') {
      const tooltipFmt = (p) => {
        const m = p[0].dataIndex;
        let h = `<b>${mtAll[m].label}</b><br/>전체 지출: ₩${allVals[m].toLocaleString()}`;
        return h;
      };
      return {
        tooltip: { trigger: 'axis', formatter: tooltipFmt, confine: true },
        legend: { data: ['전체 지출'], top: 0, textStyle: { fontSize: 11 } },
        grid,
        xAxis: { type: 'category', data: allLabels, axisLabel: { fontSize: 10 } },
        yAxis,
        series: [{ name: '전체 지출', type: 'line', smooth: true, data: allVals, showSymbol: false, lineStyle: { color: totalColor, width: 2.5 }, itemStyle: { color: totalColor }, areaStyle: { color: hexToRgba(totalColor, 0.2) } }],
      };
    }
    // 카테고리 선택 선형: 채워진 카테고리 선 + 전체 선
    const catColor = CATEGORY_COLORS[selCategory] || '#f28e2b';
    const lighter = hexToRgba(catColor, 0.25);
    const tooltipFmt = (p) => {
      const m = p[0].dataIndex;
      const key = mtAll[m].month;
      const catVal = catMap[key] || 0;
      const totVal = allVals[m];
      const pct = totVal > 0 ? ((catVal / totVal) * 100) : 0;
      let h = `<b>${mtAll[m].label}</b>`;
      h += `<br/><span style="color:${catColor}">● ${selCategory}</span> ₩${catVal.toLocaleString()}`;
      h += `<br/>전체 지출: ₩${totVal.toLocaleString()}`;
      h += `<br/><b>비중: ${pct.toFixed(1)}%</b>`;
      return h;
    };
    return {
      tooltip: { trigger: 'axis', formatter: tooltipFmt, confine: true, extraCssText: 'max-width:240px;word-break:keep-all;' },
      legend: { data: [selCategory, '전체 지출'], top: 0, textStyle: { fontSize: 11 } },
      grid,
      xAxis: { type: 'category', data: allLabels, axisLabel: { fontSize: 10 } },
      yAxis,
      series: [
        { name: selCategory, type: 'line', smooth: true, data: catVals, showSymbol: false, lineStyle: { color: catColor, width: 2.5 }, itemStyle: { color: catColor }, areaStyle: { color: lighter } },
        { name: '전체 지출', type: 'line', smooth: true, data: allVals, showSymbol: false, lineStyle: { color: totalColor, width: 2 }, itemStyle: { color: totalColor } },
      ],
    };
  }, [analysisFiltered, mt, selCategory, selMonth, trendType]);

  const handleBarClick = (params) => {
    if (params && params.dataIndex != null) {
      const m = mt[params.dataIndex]?.month;
      if (m) setSelMonth((prev) => (prev === m ? null : m));
    }
  };
  const handleDonutClick = (params) => {
    if (params && params.name) setSelCategory((prev) => (prev === params.name ? '전체' : params.name));
  };
  const resetAll = () => { setSelMonth(null); setSelCategory('전체'); };

  const isFiltered = !!selMonth || selCategory !== '전체';

  return (
    <div className="dash">
      <header className="topbar">
        <span className="brand">💸 SmartSpend</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="user-email">{user?.email}</span>
          <button className="logout" onClick={() => signOut(auth)}>로그아웃</button>
        </div>
      </header>

      <div className="filters-bar">
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          {brands.map((b) => <option key={b} value={b}>{b}카드</option>)}
        </select>
        <label>기간</label>
        <input type="date" value={startDate} max={effectiveEnd} onChange={(e) => setStartDate(e.target.value)} />
        <span>~</span>
        <input type="date" value={effectiveEnd} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        <button className="reset" onClick={() => { setStartDate(DATA_START); setEndDate(''); }}>전체</button>
      </div>

      <div className="summary">
        <div className="card"><div className="lbl">{selMonth ? `${selMonth} 지출` : '총 지출'}</div><div className="val">₩{total.toLocaleString()}</div></div>
        <div className="card"><div className="lbl">월평균 <small>(마지막 달 제외)</small></div><div className="val">₩{avg.toLocaleString()}</div></div>
        <div className="card top2">
          <div className="lbl">지출 TOP 2</div>
          <div className="top2-cols">
            {top2.map((c, i) => (
              <div key={c.name} className="top2-col">
                <div className="top2-rank">{i + 1}</div>
                <div>
                  <div className="top2-name" style={{ color: CATEGORY_COLORS[c.name] }}>{c.name}</div>
                  <div className="top2-amt">₩{c.total.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card excl-card">
          <div className="lbl">제외 항목</div>
          <div className={`excl-val ${excludedIds.size > 0 ? 'on' : ''}`}>{excludedIds.size}개</div>
          {excludedIds.size > 0 && <button className="reset" onClick={() => setExcludedIds(new Set())}>초기화</button>}
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-head">
            <h3>카테고리별 지출 <small>(클릭 시 상세 필터)</small></h3>
            {isFiltered && <button className="home-btn" onClick={resetAll} title="전체 데이터 복귀">⌂</button>}
          </div>
          <EChart option={pieOption} height={320} onClick={handleDonutClick} />
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>월별 지출 추이 <small>(클릭 시 해당 월 필터)</small></h3>
            <div className="chart-toggle">
              <button className={trendType === 'bar' ? 'on' : ''} onClick={() => setTrendType('bar')}>📊 막대</button>
              <button className={trendType === 'line' ? 'on' : ''} onClick={() => setTrendType('line')}>📈 선형</button>
            </div>
          </div>
          <EChart option={trendOption} height={320} onClick={handleBarClick} />
        </div>
      </div>

      <div className="panel">
        <div className="detail-head">
          <h3>{selCategory === '전체' ? '상세 내역' : `${selCategory} 상세 내역`} <small>({detailRows.length}건)</small></h3>
          <select value={selCategory} onChange={(e) => setSelCategory(e.target.value)} className="cat-select">
            <option value="전체">전체 카테고리</option>
            {CATEGORIES.filter((c) => c.name !== '기타' || cats.some((x) => x.name === '기타')).map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <table className="tx-table">
          <thead><tr><th>날짜</th><th>카드</th><th>가맹점</th><th>카테고리</th><th>금액</th><th>제외</th></tr></thead>
          <tbody>
            {detailRows.slice(-200).reverse().map((t, i) => {
              const excluded = excludedIds.has(t.id);
              return (
                <tr key={t.id} className={excluded ? 'excluded-row' : ''}>
                  <td>{t.date}</td><td>{t.brand}</td><td>{t.merchant}</td>
                  <td><span className="badge" style={{ background: CATEGORY_COLORS[t.category] }}>{t.category}</span></td>
                  <td className="amt">₩{t.amount.toLocaleString()}</td>
                  <td className="excl-cell"><input type="checkbox" checked={excluded} onChange={() => toggleExclude(t.id)} title="분석에서 제외" /></td>
                </tr>
              );
            })}
            {detailRows.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>해당 기간 내 내역이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}