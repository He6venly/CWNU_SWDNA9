import type { Dispatch, SetStateAction } from 'react'
import PhotoPicker from './PhotoPicker'
import type { Photo } from './PhotoPicker'
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
  clearRecognized: () => void
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
  clearRecognized,
  analyze,
}: Props) {
  return (
    <section>
      <h2>2. 기존 사진 등록</h2>
      <p>기존 사진을 선택해 주세요. 사진 선택만으로 분석하지 않습니다.</p>
      <label>
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
        <label>
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
      )}
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
      {photos.map((photo) => (
        <div key={photo.id}>
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
                  clearRecognized()
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
          <button
            disabled={busy}
            onClick={() => {
              invalidate()
              clearRecognized()
              setPhotos((current) => current.filter((p) => p.id !== photo.id))
            }}
          >
            사진 삭제
          </button>
        </div>
      ))}
      <button disabled={busy || !photos.length} onClick={analyze}>
        등록 사진 AI 분석
      </button>
    </section>
  )
}
