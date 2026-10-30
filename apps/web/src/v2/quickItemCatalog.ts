export type QuickCategory = 'power-bank' | 'cordless-iron' | 'liquid' | 'lighter' | 'electronics' | 'general-items'

export type QuickGuidance = { cabin: string; checked: string; action: string }
export type QuickItem = {
  id: string
  name: string
  category: QuickCategory
  aliases: string[]
  description: string
  guidance?: QuickGuidance
}

type Seed = [id: string, name: string, aliases?: string[], description?: string, guidance?: QuickGuidance]

const verify = (action: string): QuickGuidance => ({ cabin: '조건 확인 필요', checked: '조건 확인 필요', action })
const forbidden = (action: string): QuickGuidance => ({ cabin: '불가', checked: '불가', action })
const destination = (action: string): QuickGuidance => ({ cabin: '포장·검역 확인', checked: '포장·검역 확인', action })
const sharp = (action: string): QuickGuidance => ({ cabin: '날·길이 확인 필요', checked: '보호 포장 후 조건부', action })
const sports = (action: string): QuickGuidance => ({ cabin: '기내 제한 가능', checked: '크기·포장 확인', action })

function group(category: QuickCategory, description: string, seeds: Seed[]): QuickItem[] {
  return seeds.map(([id, name, aliases = [], itemDescription = description, guidance]) => ({ id, name, category, aliases, description: itemDescription, ...(guidance ? { guidance } : {}) }))
}

const batteries = group('power-bank', '배터리 용량·수량·단자 보호 확인', [
  ['power-bank', '보조배터리', ['휴대용 배터리', '충전 배터리', '파워뱅크'], '용량·수량·단자 보호 확인'],
  ['camera-battery', '카메라 여분 배터리', ['카메라 배터리'], '여분 배터리 단자 보호 확인', { cabin: '조건 확인 후 기내', checked: '위탁 불가', action: '용량을 확인하고 단자를 개별 절연해 기내에 휴대하세요.' }],
  ['spare-batteries', '일반·여분 배터리', ['건전지', 'AA 배터리', 'AAA 배터리'], '배터리 종류와 단자 보호 확인', { cabin: '종류 확인 후 기내', checked: '리튬 여분은 불가', action: '배터리 종류를 확인하고 여분 리튬 배터리는 단자를 보호해 기내에 휴대하세요.' }],
  ['button-battery', '단추형 배터리', ['버튼 배터리', '코인 배터리'], '여분 배터리 단자 보호 확인'],
])

const lithium = group('electronics', '배터리 용량·분리 가능 여부 확인', [
  ['laptop', '노트북', ['랩탑', '맥북']],
  ['e-cigarette', '전자담배', ['전자 담배', '액상형 전자담배'], '배터리·액상 포함 기기', { cabin: '조건 확인 후 기내', checked: '위탁 불가', action: '기내 충전·사용은 금지되며 오작동을 방지하고 액상 규정도 확인하세요.' }],
  ['drone', '드론', ['무인기', '쿼드콥터']],
  ['bluetooth-earbuds', '무선 이어폰', ['블루투스 이어폰', '에어팟', '버즈']],
  ['smart-luggage', '스마트 캐리어', ['스마트 가방', '배터리 캐리어'], '배터리 분리 가능 여부 확인', verify('배터리가 분리되는지 확인하고 위탁 시 항공사 배터리 기준을 따르세요.')],
  ['portable-fan', '휴대용 선풍기', ['손선풍기', '미니 선풍기']],
  ['electric-toothbrush', '전동칫솔', ['전기 칫솔']],
  ['electric-shaver', '전기면도기', ['충전식 면도기']],
  ['e-scooter', '전동킥보드·호버보드', ['전동 스쿠터', '전동휠', '평형차'], '개인용 전동 이동장치', verify('대용량 배터리 개인 이동장치는 일반 수하물로 제한되는 경우가 많아 항공사 사전 승인을 확인하세요.')],
  ['electric-wheelchair', '전동휠체어·전동스쿠터', ['전동 휠체어', '이동 보조기기'], '이동 보조기기 사전 승인', verify('배터리 종류와 분리 가능 여부를 항공사에 알리고 사전 승인을 받으세요.')],
  ['game-console', '게임기·휴대용 게임기', ['닌텐도 스위치', '스팀덱', '콘솔']],
  ['smartphone', '휴대전화·태블릿', ['스마트폰', '핸드폰', '아이패드', '갤럭시탭']],
  ['camera', '카메라·촬영 장비', ['DSLR', '미러리스', '디지털 카메라']],
  ['bluetooth-speaker', '블루투스 스피커', ['무선 스피커']],
  ['robot-vacuum', '로봇청소기', ['로봇 진공청소기']],
])

const general = group('general-items', '크기·포장·위험 요소 확인', [
  ['tripod', '삼각대', ['카메라 삼각대', '셀카봉']],
  ['umbrella', '우산', ['장우산', '접이식 우산']],
  ['thermos', '보온병·텀블러', ['보온 물병', '텀블러'], '내용물을 비우고 크기 확인'],
  ['dry-ice', '드라이아이스', ['고체 이산화탄소'], '수량·환기·항공사 승인 확인', verify('허용 수량과 포장 환기 조건을 확인하고 항공사 사전 승인을 받으세요.')],
  ['car-seat', '유아용 카시트', ['자동차 안전 좌석']],
  ['hand-warmer', '핫팩·전열 의류', ['손난로', '전기담요', '발열조끼'], '연료·배터리 방식 확인', verify('일회용·연료식·배터리식인지 확인하고 연료 또는 배터리 규정을 적용하세요.')],
  ['power-tools', '전동공구', ['전기 공구', '드릴'], '배터리와 날·부속품 분리 확인', verify('배터리 용량과 분리 여부, 날카로운 부속품의 보호 포장을 확인하세요.')],
  ['live-animals', '반려동물·살아있는 동물', ['애완동물', '강아지', '고양이'], '항공사 운송 신청 필요', verify('항공사 운송 예약, 검역 서류, 케이지 기준을 사전에 확인하세요.')],
  ['magnets', '자석', ['강력 자석', '네오디뮴 자석'], '자기장 세기 확인', verify('강한 자기장은 항공 운송이 제한될 수 있으므로 차폐와 항공사 기준을 확인하세요.')],
  ['hair-dryer', '헤어드라이어', ['드라이기']],
  ['laser-pointer', '레이저 포인터', ['레이저펜'], '출력과 배터리 확인', verify('레이저 출력과 목적지 규제, 내장 배터리 조건을 확인하세요.')],
  ['musical-instrument', '악기', ['기타', '바이올린', '관악기'], '크기·재질·별도 좌석 여부 확인'],
  ['candles', '양초', ['캔들', '향초'], '연료·젤 포함 여부 확인'],
  ['binoculars', '쌍안경', ['망원경']],
  ['jewelry', '보석·귀중품', ['귀금속', '명품 시계'], '분실 위험 때문에 기내 휴대 권장'],
  ['cremated-remains', '유골함', ['화장 유골'], '서류·용기 검색 가능 여부 확인', verify('항공사 사전 문의와 증명서, 보안검색 가능한 용기 재질을 확인하세요.')],
])

const irons = group('cordless-iron', '유선·가스·배터리 방식 확인', [
  ['curling-iron', '고데기·봉고데기', ['헤어 아이론', '무선 고데기', '매직기'], '전원과 열원 방식 확인'],
])

const food = group('general-items', '도착국 검역·세관 규정 확인', [
  ['meat-products', '육류 제품', ['고기', '육포', '소시지', '햄'], undefined, destination('출발·도착국의 동물검역과 반입 금지 품목을 확인하고 반드시 신고하세요.')],
  ['fresh-fruits', '신선 과일', ['생과일', '과일'], undefined, destination('도착국 식물검역과 검역증명서 필요 여부를 확인하고 반드시 신고하세요.')],
  ['instant-noodles', '라면·즉석면', ['컵라면', '봉지라면'], undefined, destination('육류 성분 스프와 목적지 식품 반입 규정을 확인하세요.')],
  ['baby-food', '유아식·모유', ['이유식', '분유', '모유'], '유아 동반·액체 예외 확인', destination('유아 동반 여부, 필요량, 액체 검색 절차와 목적지 검역 규정을 확인하세요.')],
  ['semi-liquid-food', '소스·반고체 식품', ['고추장', '된장', '잼', '소스'], '액체·젤류와 세관 규정 확인', destination('기내 액체·젤 용량 제한과 목적지 식품 검역을 함께 확인하세요.')],
  ['canned-food', '통조림', ['캔 식품'], undefined, destination('육류·수산물 성분과 목적지 검역, 용기 상태를 확인하세요.')],
  ['frozen-food', '냉동식품·아이스팩', ['보냉제', '젤 아이스팩'], '보냉제 상태와 검역 확인', destination('냉동 상태, 보냉제·드라이아이스 규정과 목적지 검역을 확인하세요.')],
  ['seafood', '생선·해산물', ['수산물', '생선', '회'], undefined, destination('포장·누출 방지와 목적지 수산물 검역 및 신고 기준을 확인하세요.')],
  ['dry-snacks', '과자·건조식품', ['스낵', '말린 식품'], undefined, destination('육류·종자 성분 포함 여부와 목적지 식품 반입 기준을 확인하세요.')],
  ['powder-food', '분말 식품', ['가루 식품', '단백질 파우더'], undefined, destination('대량 분말 검색 절차와 목적지 식품 반입 기준을 확인하세요.')],
  ['tea-coffee', '차·커피', ['찻잎', '원두', '커피콩'], undefined, destination('식물성 원료의 목적지 검역·신고 기준을 확인하세요.')],
  ['cooking-oil', '식용유·식초', ['참기름', '올리브유', '식초'], '액체 용량과 누출 방지 확인', destination('기내 액체 제한, 위탁 누출 방지, 목적지 식품 규정을 확인하세요.')],
  ['pet-food', '반려동물 사료', ['개 사료', '고양이 사료'], undefined, destination('육류 성분과 목적지 동물검역·신고 기준을 확인하세요.')],
  ['seeds-plants', '씨앗·식물', ['종자', '화분', '묘목'], undefined, destination('식물검역증명서와 흙 포함 여부, 목적지 반입 금지를 확인하세요.')],
])

const sportItems = group('general-items', '크기·끝부분·보호 포장 확인', [
  ['hiking-poles', '등산 스틱', ['트레킹 폴'], undefined, sports('뾰족한 끝부분을 보호하고 기내 반입 제한과 위탁 포장을 확인하세요.')],
  ['golf-clubs', '골프채', ['골프 클럽'], undefined, sports('기내 반입이 제한될 수 있으므로 전용 가방과 위탁 규정을 확인하세요.')],
  ['sports-bat', '야구방망이·스포츠 스틱', ['배트', '하키 스틱'], undefined, sports('타격용 장비는 기내 반입이 제한될 수 있으므로 위탁 규정을 확인하세요.')],
  ['tennis-racket', '라켓', ['테니스 라켓', '배드민턴 라켓']],
  ['scuba-gear', '스쿠버다이빙 장비', ['잠수 장비', '다이빙 장비'], undefined, sports('공기통은 완전히 비우고 밸브·배터리·칼 등 구성품별 규정을 확인하세요.')],
  ['fishing-gear', '낚시 장비', ['낚싯대', '낚시바늘'], undefined, sports('바늘·칼·긴 낚싯대는 보호 포장하고 기내 제한과 위탁 규정을 확인하세요.')],
  ['yoga-mat', '요가매트·운동 소품', ['요가 매트', '폼롤러']],
  ['bicycle', '자전거', ['사이클'], undefined, sports('항공사 스포츠 장비 예약, 포장, 타이어·배터리 조건을 확인하세요.')],
  ['skateboard', '스케이트보드·인라인스케이트', ['보드', '롤러스케이트']],
  ['ski-gear', '스키·스노보드 장비', ['스키', '스노보드'], undefined, sports('항공사 스포츠 장비 크기·중량과 날 보호 포장을 확인하세요.')],
])

const liquids = group('liquid', '용량·성분·누출 방지 확인', [
  ['hair-spray', '헤어스프레이', ['헤어 스프레이', '정발 스프레이']],
  ['perfume', '향수', ['오드퍼퓸', '코롱']],
  ['sunscreen', '선크림', ['자외선 차단제', '선로션']],
  ['skincare-liquid', '액체 화장품·스킨케어', ['스킨', '로션', '화장품']],
  ['alcohol-beverage', '주류', ['술', '와인', '맥주', '위스키'], '알코올 도수·용량·세관 확인', verify('알코올 도수와 용량, 항공 운송 제한, 목적지 면세·세관 한도를 확인하세요.')],
  ['insecticide', '살충제', ['벌레약', '살충 스프레이'], '가연성·독성 성분 확인', verify('가연성 또는 독성 살충제는 반입이 금지될 수 있으므로 제품 표시와 항공사 기준을 확인하세요.')],
  ['insect-repellent', '모기 기피제', ['모기약', '방충제'], '성분·용량·분사 방지 확인'],
  ['hand-sanitizer', '손소독제', ['휴대용 소독제', '알코올 젤'], '알코올 함량·용량 확인'],
  ['wet-wipes', '물티슈·소독티슈', ['습식 티슈', '소독 물티슈']],
])

const medical = group('general-items', '의료 필요성·서류·보관 조건 확인', [
  ['medication', '의약품', ['약', '상비약', '처방약'], undefined, verify('성분과 수량, 처방전·영문 증빙, 목적지 반입 규정을 확인하세요.')],
  ['insulin-syringes', '인슐린·주사기', ['인슐린 주사', '주삿바늘'], undefined, verify('의료 필요 증빙, 약품 보관, 바늘 보호와 보안검색 절차를 확인하세요.')],
  ['contact-lens-solution', '렌즈 세정액', ['렌즈액', '식염수'], '의료용 액체 용량 확인', verify('기내 액체 제한과 의료 목적 예외 적용 여부를 확인하세요.')],
  ['cpap', '양압기·분무치료기', ['CPAP', '호흡기', '네뷸라이저'], '의료기기 배터리·사용 승인 확인', verify('기내 사용 가능 여부, 배터리 용량, 항공사 사전 신고를 확인하세요.')],
  ['mercury-thermometer', '수은 체온계', ['수은 온도계'], '수은 포함 의료기기', verify('보호 케이스와 항공사 허용 범위를 사전에 확인하세요.')],
  ['inhaler', '흡입기·응급 주사', ['천식 흡입기', '에피펜'], '의료 증빙·가압 용기 확인', verify('처방 또는 의료 필요 증빙과 가압 용기·주삿바늘 검색 절차를 확인하세요.')],
  ['prosthetics', '의수·의족·보조기', ['보철물', '교정기', '보호대'], '보안검색과 배터리 여부 확인', verify('보안검색 지원과 내장 배터리·공구 구성품을 사전에 항공사에 알리세요.')],
  ['medical-cannabis', '의료용 대마·CBD', ['CBD 오일', '대마 의약품'], '국가별 금지·허가 확인', { cabin: '국가별 허가 필요', checked: '국가별 허가 필요', action: '처방 여부와 무관하게 출발·도착·환승국 법률상 금지될 수 있으므로 정부기관에 확인하세요.' }],
])

const sharpItems = group('general-items', '날·끝부분·보호 포장 확인', [
  ['scissors', '가위', ['미용 가위', '문구 가위'], undefined, sharp('날 길이와 형태에 따라 기내 반입이 제한될 수 있으므로 보호 포장 후 항공사 기준을 확인하세요.')],
  ['swiss-army-knife', '맥가이버칼·스위스 아미 나이프', ['멀티툴', '스위스칼'], undefined, sharp('칼날이 포함된 멀티툴은 기내 반입이 제한되므로 잠금·보호 포장 후 위탁 기준을 확인하세요.')],
  ['nail-clippers', '손톱깎이', ['네일 클리퍼']],
  ['razor', '면도기·면도날', ['일회용 면도기', '면도칼'], undefined, sharp('노출형 면도날은 기내 반입이 제한될 수 있으므로 날 형태와 보호 포장을 확인하세요.')],
  ['utility-knife', '커터칼·미술용 칼', ['박스커터', '아트 나이프'], undefined, { cabin: '불가', checked: '보호 포장 후 조건부', action: '칼날은 기내에 휴대하지 말고 분리·보호 포장한 뒤 위탁 기준을 확인하세요.' }],
  ['tweezers-needles', '핀셋·바느질바늘', ['족집게', '재봉 바늘']],
  ['corkscrew', '병따개·와인 오프너', ['코르크스크루', '와인 나이프'], undefined, sharp('칼날 포함 여부에 따라 기내 반입이 제한되므로 제품 형태를 확인하세요.')],
])

const prohibited = group('general-items', '위험물·법적 제한 확인', [
  ['self-defense-spray', '호신용 스프레이', ['페퍼스프레이', '최루 스프레이'], undefined, forbidden('호신용·최루 성분 스프레이는 기내와 위탁 모두 제한됩니다.')],
  ['fireworks', '폭죽·불꽃놀이 용품', ['화약', '폭죽'], undefined, forbidden('폭발성 물질은 기내와 위탁 모두 반입할 수 없습니다.')],
  ['toy-gun', '장난감 총·모형 무기', ['비비탄총', '모형 총'], undefined, { cabin: '불가', checked: '항공사 확인 필요', action: '실제 무기로 오인될 수 있어 기내 반입이 제한됩니다. 위탁 가능 여부를 항공사에 확인하세요.' }],
  ['bleach', '표백제·부식성 세정제', ['락스', '강산성 세제'], undefined, forbidden('부식성 화학물질은 기내와 위탁 모두 제한됩니다.')],
  ['stun-gun', '전기충격기·호신 무기', ['테이저', '전기 충격기'], undefined, forbidden('호신 무기와 전기충격기는 기내와 위탁 모두 제한됩니다.')],
  ['firearms', '총기·탄약', ['총', '실탄'], undefined, { cabin: '불가', checked: '기관·항공사 승인 필요', action: '법적 허가와 항공사 사전 승인 없이 운송할 수 없습니다.' }],
  ['fire-extinguisher', '소화기·압축가스 용기', ['소화기', '가스 실린더'], undefined, forbidden('압축가스 용기는 일반 수하물로 반입할 수 없습니다.')],
])

const flammable = group('lighter', '연료·가연성 성분 확인', [
  ['lighter', '라이터', ['일회용 라이터', '가스 라이터']],
  ['safety-matches', '안전성냥', ['성냥']],
  ['camping-gas', '부탄가스·캠핑 가스통', ['카세트 가스', '가스 캔'], undefined, forbidden('연료가 든 가스 용기는 기내와 위탁 모두 반입할 수 없습니다.')],
  ['spray-paint', '스프레이 페인트·가연성 용제', ['락카', '페인트 스프레이', '신나'], undefined, forbidden('가연성 페인트와 용제는 기내와 위탁 모두 반입할 수 없습니다.')],
  ['gas-torch', '가스토치·부탄 연료', ['토치', '부탄가스 토치'], undefined, forbidden('토치와 부탄 연료는 기내와 위탁 모두 반입할 수 없습니다.')],
])

const customs = group('general-items', '목적지 세관 신고 한도 확인', [
  ['cigarettes', '담배', ['궐련', '종이담배'], undefined, verify('목적지 국가의 면세 수량, 연령 제한과 세관 신고 기준을 확인하세요.')],
  ['cash', '현금·외화', ['현금', '외국 돈', '수표'], undefined, verify('출발·도착국의 현금 신고 기준액과 증빙 서류를 확인하세요.')],
])

const extraKoreanSearchItems = group('liquid', '용량·성분 확인', [
  ['shampoo', '샴푸·린스', ['컨디셔너']],
  ['toothpaste', '치약', ['구강 젤']],
])

const canFlyItems: QuickItem[] = [
  ...batteries,
  ...lithium,
  ...irons,
  ...general,
  ...food,
  ...sportItems,
  ...liquids,
  ...medical,
  ...sharpItems,
  ...prohibited,
  ...flammable,
  ...customs,
]

export const canFlyItemIds = canFlyItems.map((item) => item.id)

export const quickItemCatalog: QuickItem[] = [
  ...canFlyItems,
  ...extraKoreanSearchItems,
]

const normalize = (value: string) => value.toLocaleLowerCase('ko-KR').replace(/[\s_-]+/g, '')

export function searchQuickItems(query: string) {
  const keyword = normalize(query)
  if (!keyword) return []
  return quickItemCatalog
    .map((item) => {
      const name = normalize(item.name)
      const aliases = item.aliases.map(normalize)
      const score = name.startsWith(keyword) ? 0 : aliases.some((alias) => alias.startsWith(keyword)) ? 1 : name.includes(keyword) ? 2 : aliases.some((alias) => alias.includes(keyword)) ? 3 : 99
      return { item, score }
    })
    .filter(({ score }) => score < 99)
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, 'ko-KR'))
    .map(({ item }) => item)
}
