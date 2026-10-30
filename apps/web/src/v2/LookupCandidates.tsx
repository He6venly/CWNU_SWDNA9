import type { LookupResponse } from '../../../../contract/v2/types.ts'
import { FIELD_KEYS } from '../../../../contract/v2/constants.ts'
import { labels } from '../../../../contract/v2/labels.ts'

const searchPolicy =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'\">"
export default function LookupCandidates({
  value,
  disabled,
  onSelect,
}: {
  value: LookupResponse
  disabled: boolean
  onSelect: (candidate: LookupResponse['candidates'][number]) => void
}) {
  return (
    <div>
      <p>
        {value.meta.isDemoLookup
          ? '시연 제품 후보'
          : '검색된 제품 후보 — 실제 제품과 일치하는지 확인 필요'}
      </p>
      <p>{value.message}</p>
      {value.candidates.map((candidate) => (
        <article key={candidate.id}>
          <h4>{candidate.name}</h4>
          {FIELD_KEYS.filter((field) => candidate.fields[field] !== null).map(
            (field) => (
              <p key={field}>
                {labels.fields[field]}: {candidate.fields[field]}
              </p>
            ),
          )}
          {candidate.sources.map((source) => (
            <p key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            </p>
          ))}
          <button disabled={disabled} onClick={() => onSelect(candidate)}>
            빈 제품 정보에 적용 후 확인
          </button>
        </article>
      ))}
      {value.searchSuggestions && (
        <iframe
          title="Google 검색 제안"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          srcDoc={searchPolicy + value.searchSuggestions}
          style={{ width: '100%', border: 0, minHeight: 160 }}
        />
      )}
    </div>
  )
}
