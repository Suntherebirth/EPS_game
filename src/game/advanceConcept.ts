import type { AdvanceConcept, AnnouncementTone, ScenarioAnnouncement } from './scenario'

/**
 * 진루 성격(안전/당연/과감/진루불가) 하나로 아나운스 톤과 베이스 도착 전환을 함께 결정한다.
 * 새 진루 아나운스를 만들 때는 `advance`를 명시하고, tone은 이 표에서 유도되게 둔다.
 * 설계 배경은 docs/ux-ui-guide.md "베이스 도착 전환 연출" 절 참고.
 */
export const ADVANCE_CONCEPT_TONE: Record<AdvanceConcept, AnnouncementTone> = {
  safe: 'neutral',
  normal: 'neutral',
  bold: 'positive',
  blocked: 'neutral',
}

/** neutral은 tone 미지정과 같은 의미라 굳이 필드를 붙이지 않는다. */
export const resolveAdvanceTone = (advance: AdvanceConcept | undefined): AnnouncementTone | undefined => {
  if (!advance) return undefined
  const tone = ADVANCE_CONCEPT_TONE[advance]
  return tone === 'neutral' ? undefined : tone
}

const SAFE_ADVANCE_TITLES = new Set(['볼넷!', '사구!'])
const BLOCKED_ADVANCE_DETAIL = /움직이지 못했습니다/
const BOLD_ADVANCE_TEXT = /애매|도루|위험을 감수/

/** `advance` 미지정 아나운스를 위한 문구 기반 추론. 새 문구에는 되도록 `advance`를 직접 지정한다. */
export const inferAdvanceConcept = (announcement: Pick<ScenarioAnnouncement, 'title' | 'detail'>): AdvanceConcept => {
  if (BLOCKED_ADVANCE_DETAIL.test(announcement.detail)) return 'blocked'
  if (SAFE_ADVANCE_TITLES.has(announcement.title)) return 'safe'
  if (BOLD_ADVANCE_TEXT.test(`${announcement.title} ${announcement.detail}`)) return 'bold'
  return 'normal'
}

export const resolveAdvanceConcept = (
  announcement: Pick<ScenarioAnnouncement, 'title' | 'detail' | 'advance'> | undefined,
): AdvanceConcept | undefined => {
  if (!announcement) return undefined
  return announcement.advance ?? inferAdvanceConcept(announcement)
}
