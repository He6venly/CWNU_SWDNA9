import { useState } from 'react'
import App from './App.tsx'
import AppV2 from './AppV2.tsx'

export default function CheckApp() {
  const [version, setVersion] = useState('v2')
  return <><nav aria-label="검증 API 버전"><button onClick={() => setVersion('v2')} aria-pressed={version === 'v2'}>2.0 계약 확인</button><button onClick={() => setVersion('v1')} aria-pressed={version === 'v1'}>기존 1.0 확인</button></nav>{version === 'v2' ? <AppV2 /> : <App />}</>
}
