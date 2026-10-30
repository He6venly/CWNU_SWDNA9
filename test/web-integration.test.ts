import { describe, it, expect, vi } from 'vitest'
import { mergeLabel } from '../apps/web/src/v2/mergeLabel.ts'
import { createManualItem, createNamedManualItem } from '../contract/v2/manual.ts'
import { recognizeDemo } from '../contract/v2/demo.ts'
import { RecognizeRequestSchema, RulesResponseSchema } from '../contract/v2/schemas.ts'
import requests from '../contract/v2/fixtures/requests.json' with { type: 'json' }
import { recognizeCached, clearRecognitionCache } from '../apps/web/src/v2/recognitionCache.ts'
import { api } from '../apps/web/src/v2/api.ts'
import { analyzeImagePixels, imageLongEdge } from '../apps/check/src/image-analysis.ts'
import { canFlyItemIds, quickItemCatalog, searchQuickItems } from '../apps/web/src/v2/quickItemCatalog.ts'
import { quickItemIcons } from '../apps/web/src/v2/quickItemIcons.ts'
import { quickRuleGuidance } from '../apps/web/src/v2/quickRuleGuidance.ts'
import { flightTypeForCountries } from '../apps/web/src/v2/travelCountries.ts'
import ruleExample from '../contract/v2/fixtures/rules.json' with { type: 'json' }
const input = RecognizeRequestSchema.parse(requests.label)
describe('사용자 화면 라벨 보완·인식 캐시', () => {
  it('사용자 값·다른 카드·수량을 보존하고 빈 사양만 보완하며 확인을 해제', () => {
    const item = createManualItem('power-bank', 'target-1')
    item.fields.wh = 60; item.fieldSources.wh = { source: 'user', confirmed: true }
    item.unreadFields = item.unreadFields.filter(key => key !== 'wh'); item.confirmed = true
    const label = { ...recognizeDemo(input).items[0]!, id: item.id }
    const merged = mergeLabel(item, label)
    expect(merged.id).toBe(item.id); expect(merged.fields.wh).toBe(60)
    expect(merged.fields.mah).toBe(label.fields.mah); expect(merged.confirmed).toBe(false)
    expect(item.confirmed).toBe(true); expect(merged.details?.confirmed).toBe(false)
    expect(() => mergeLabel(item, { ...label, id: 'wrong-id' })).toThrow()
    expect(() => mergeLabel(item, { ...label, categoryId: 'liquid' })).toThrow()
  })
  it('동일 요청은 재사용하고 범위 변경·초기화·취소는 재사용하지 않음', async () => {
    clearRecognitionCache()
    const network = vi.spyOn(api, 'recognize').mockResolvedValue(recognizeDemo(input))
    try {
      const signal = new AbortController().signal
      const first = await recognizeCached(input, 'scope-a', signal)
      const second = await recognizeCached(input, 'scope-a', signal)
      expect(second).toEqual(first); expect(second).not.toBe(first); expect(network).toHaveBeenCalledTimes(1)
      await recognizeCached(input, 'scope-b', signal); expect(network).toHaveBeenCalledTimes(2)
      clearRecognitionCache(); await recognizeCached(input, 'scope-b', signal); expect(network).toHaveBeenCalledTimes(3)
      const controller = new AbortController(); controller.abort()
      await expect(recognizeCached(input, 'scope-b', controller.signal)).rejects.toThrow()
      expect(network).toHaveBeenCalledTimes(3)
    } finally { network.mockRestore(); clearRecognitionCache() }
  })
})

describe('사진 전송 전 경량 분석', () => {
  it('어둡고 평탄한 사진은 경고하고 라벨 모드는 해상도를 더 보존', () => {
    const pixels = new Uint8ClampedArray(32 * 32 * 4)
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255
    expect(analyzeImagePixels(pixels, 32, 32, 'overview').warnings).toHaveLength(2)
    expect(imageLongEdge('label', 1280)).toBe(1800)
    expect(imageLongEdge('overview', 1280)).toBe(1280)
  })

  it('라벨처럼 모인 고주파 영역만 보수적으로 크롭', () => {
    const width = 100, height = 100, pixels = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const value = x >= 25 && x <= 75 && y >= 55 && y <= 82 && y % 4 < 2 ? 20 : 180
      pixels[offset] = value; pixels[offset + 1] = value; pixels[offset + 2] = value; pixels[offset + 3] = 255
    }
    const label = analyzeImagePixels(pixels, width, height, 'label')
    expect(label.crop).toBeDefined()
    expect(label.crop!.width * label.crop!.height).toBeLessThan(0.88)
    expect(analyzeImagePixels(pixels, width, height, 'overview').crop).toBeUndefined()
  })
})

describe('빠른 규정 품목 검색', () => {
  const limits = RulesResponseSchema.parse(ruleExample).ruleLimits
  const guidance = (id: string, flightType: 'domestic' | 'international' = 'international') => quickRuleGuidance(quickItemCatalog.find(item => item.id === id)!, flightType, limits)

  it('품목명과 별칭을 즉시 검색하고 관련 없는 결과를 제외', () => {
    expect(searchQuickItems('가').map((item) => item.name)).toContain('가위')
    expect(searchQuickItems('에어팟')[0]?.name).toBe('무선 이어폰')
    expect(searchQuickItems('없는 품목')).toEqual([])
  })

  it('CanFly 전체 목록의 98개 식별자를 중복 없이 포함', () => {
    expect(canFlyItemIds).toHaveLength(98)
    expect(new Set(canFlyItemIds).size).toBe(98)
    expect(canFlyItemIds).toEqual(expect.arrayContaining(['power-bank', 'meat-products', 'hiking-poles', 'medical-cannabis', 'cash']))
  })

  it('검색 가능한 모든 품목에 개별 아이콘을 제공', () => {
    expect(canFlyItemIds.filter((id) => !quickItemIcons[id])).toEqual([])
    expect(quickItemIcons.shampoo).toBeTruthy()
    expect(quickItemIcons.toothpaste).toBeTruthy()
  })

  it('검색 품목을 여섯 분류의 수동 입력 항목으로 변환', () => {
    const item = createNamedManualItem('general-items', '가위', 'manual-scissors')
    expect(item.name).toBe('가위')
    expect(item.categoryId).toBe('general-items')
    expect(item.details?.type).toBe('general-items')
  })

  it('명시된 항공사 수치를 해당 품목에만 표시', () => {
    expect(guidance('power-bank').action).toContain('160Wh')
    expect(guidance('power-bank').action).toContain('2개')
    expect(guidance('laptop').action).toContain('15개')
    expect(guidance('curling-iron').cabin).toContain('160Wh')
    expect(guidance('perfume').action).toContain('500mL')
    expect(guidance('perfume').action).toContain('2000mL')
    expect(guidance('alcohol-beverage').action).toContain('24%')
    expect(guidance('alcohol-beverage').action).toContain('70%')
    expect(guidance('hand-sanitizer').action).toContain('500mL')
    expect(guidance('lighter').action).toContain('합쳐 1명당 1개')
    expect(guidance('semi-liquid-food').cabin).toContain('100mL')
    expect(guidance('wet-wipes').cabin).not.toContain('100mL')
    expect(guidance('e-scooter').action).not.toContain('160Wh')
  })
})

describe('여행 국가 선택', () => {
  it('선택 국가에 맞춰 국내선과 국제선을 자동 전환', () => {
    expect(flightTypeForCountries('KR', 'KR', 'international')).toBe('domestic')
    expect(flightTypeForCountries('KR', 'JP', 'domestic')).toBe('international')
    expect(flightTypeForCountries('JP', 'KR', 'domestic')).toBe('international')
    expect(flightTypeForCountries('KR', '', 'domestic')).toBe('domestic')
  })
})
