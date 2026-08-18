'use client';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function EChart({ option, height = 340, onClick }) {
  const ref = useRef(null);
  const instRef = useRef(null);
  const onClickRef = useRef(onClick);

  useEffect(() => { onClickRef.current = onClick; }, [onClick]);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    instRef.current = chart;
    chart.setOption(option);
    if (onClick) chart.on('click', (params) => { onClickRef.current && onClickRef.current(params); });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (instRef.current) instRef.current.setOption(option, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option]);

  return <div ref={ref} style={{ width: '100%', height }} />;
}