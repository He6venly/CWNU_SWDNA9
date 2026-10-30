import { useEffect, useState } from 'react'
import UiIcon from '../../../check/src/UiIcon.tsx'
import airplane from '../../../../changgo-icons/airplane.png'

export default function LandingScreen({ onEnter }: { onEnter: () => void }) {
  const [departing, setDeparting] = useState(false)

  useEffect(() => {
    if (!departing) return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 220 : 900
    const timer = window.setTimeout(onEnter, duration)
    return () => window.clearTimeout(timer)
  }, [departing, onEnter])

  return <div className={`landing-screen${departing ? ' departing' : ''}`}>
    <div className="landing-ambient-plane" aria-hidden="true"><span /><img src={airplane} alt="" /></div>
    <div className="landing-inner">
      <header className="landing-topbar">
        <span>TRAVEL PACKING ASSISTANT</span>
        <span>사진 인식 · 항공 규정 · 여행 기록</span>
      </header>

      <main className="landing-content">
        <div className="landing-wordmark">
          <div className="landing-title-orbit">
            <strong>챙기고</strong>
            <svg className="landing-orbit-trail" viewBox="0 0 320 128" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="160" cy="64" rx="153" ry="55" pathLength="1" /></svg>
            <span className="landing-orbit-plane" aria-hidden="true"><img src={airplane} alt="" /></span>
          </div>
          <span className="landing-wordmark-en">PACK &amp; FLY</span>
        </div>
        <p className="landing-kicker">PACK SMART, FLY LIGHT</p>
        <h1>짐 걱정은 덜고,<br /><strong>여행은 가볍게.</strong></h1>
        <p className="landing-description">사진 한 장으로 물품을 확인하고, 항공사 반입 규정과 여행별 준비 목록까지 한 번에 챙기세요.</p>
        <button className="landing-enter" disabled={departing} onClick={() => setDeparting(true)}>여행 준비 시작하기 <img className="landing-airplane-image" src={airplane} alt="" /></button>
      </main>

      <div className="landing-features" aria-label="주요 기능">
        <div><UiIcon name="photo" /><span className="landing-feature-copy"><strong>사진으로 등록</strong><small>여러 물품을 빠르게 정리</small></span></div>
        <div><UiIcon name="verify" /><span className="landing-feature-copy"><strong>규정으로 판정</strong><small>기내·위탁 조건을 분리 확인</small></span></div>
        <div><UiIcon name="album" /><span className="landing-feature-copy"><strong>여행별 기록</strong><small>준비 목록을 저장하고 재사용</small></span></div>
      </div>
    </div>
    <div className="landing-transition-plane" aria-hidden="true"><img src={airplane} alt="" /></div>
  </div>
}
