import type { Dispatch, SetStateAction } from 'react'
import PhotoPicker from './PhotoPicker'
import type { Photo } from './PhotoPicker'
import UiIcon from '../../../check/src/UiIcon.tsx'
type Props = {
  photos: Photo[]
  captureMode: 'overview' | 'detail'
  mode: 'label' | 'estimate'
  busy: boolean
  resetPhotos: () => void
  setCaptureMode: Dispatch<SetStateAction<'overview' | 'detail'>>
  setMode: Dispatch<SetStateAction<'label' | 'estimate'>>
  setPhotos: Dispatch<SetStateAction<Photo[]>>
  setPreparing: (value: boolean) => void
  message: (text: string) => void
  invalidate: () => void
  analyze: () => void
}
export default function PhotoSection({
  photos,
  captureMode,
  mode,
  busy,
  resetPhotos,
  setCaptureMode,
  setMode,
  setPhotos,
  setPreparing,
  message,
  invalidate,
  analyze,
}: Props) {
  return (
    <section id="photo" className="card-section photo-section">
      <div className="section-heading"><UiIcon name="photo" /><div><p className="eyebrow">PHOTO SCAN</p><h2>기존 사진 등록</h2><p>보관함의 사진을 선택해 주세요. 선택만으로 AI가 실행되지 않습니다.</p></div></div>
      <div className="photo-controls"><label className="form-field">
        사진 등록 방식
        <select
          value={captureMode}
          onChange={(e) => {
            resetPhotos()
            setCaptureMode(e.target.value as 'overview' | 'detail')
          }}
        >
          <option value="overview">전체 짐 사진</option>
          <option value="detail">개별 물품 사진</option>
        </select>
      </label>
      {captureMode === 'detail' && (
        <label className="form-field">
          개별 식별 방식
          <select
            value={mode}
            onChange={(e) => {
              resetPhotos()
              setMode(e.target.value as 'label' | 'estimate')
            }}
          >
            <option value="label">라벨 판독</option>
            <option value="estimate">물품 종류 추정</option>
          </select>
        </label>
      )}</div>
      <div className="upload-zone">
        <span className="upload-icon" aria-hidden="true">↥</span>
        <strong>{captureMode === 'overview' ? '전체 짐 사진을 등록하세요' : '물품 또는 라벨 사진을 등록하세요'}</strong>
        <small>JPEG · PNG · WebP / 전송 전 자동 압축·품질 확인</small>
      <PhotoPicker
        key={`${captureMode}-${mode}`}
        maxImages={captureMode === 'overview' ? 1 : 3}
        defaultKind={
          captureMode === 'overview'
            ? 'overview'
            : mode === 'label'
              ? 'label'
              : 'closeup'
        }
        onStart={resetPhotos}
        onChange={setPhotos}
        onWorking={setPreparing}
        onMessage={message}
      />
      </div>
      <div className="photo-grid">{photos.map((photo) => (
        <div className="photo-preview" key={photo.id}>
          <img
            className="photo"
            alt={`선택한 사진 ${photo.id}`}
            src={photo.preview}
          />
          {captureMode === 'detail' && (
            <label>
              사진 종류
              <select
                value={photo.kind}
                onChange={(e) => {
                  invalidate()
                  setPhotos((current) =>
                    current.map((p) =>
                      p.id === photo.id
                        ? { ...p, kind: e.target.value as Photo['kind'] }
                        : p,
                    ),
                  )
                }}
              >
                <option value="label">라벨</option>
                <option value="closeup">물품 근접 사진</option>
              </select>
            </label>
          )}
          <button className="danger-action"
            disabled={busy}
            onClick={() => {
              invalidate()
              setPhotos((current) => current.filter((p) => p.id !== photo.id))
            }}
          >
            사진 삭제
          </button>
        </div>
      ))}</div>
      <button className="primary-action analyze-button" disabled={busy || !photos.length} onClick={analyze}>
        <span aria-hidden="true">✦</span> 등록 사진 AI 분석
      </button>
    </section>
  )
}
