import './globals.css';

export const metadata = {
  title: 'SmartSpend - 지능형 개인 재무 관리',
  description: '카드 지출 데이터 기반 지출 분석 및 예측 대시보드',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}