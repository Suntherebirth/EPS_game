import type { SceneId, ScenarioAnnouncement } from './scenario'
import { getPlayerBaseLabel, getPlayerDestinationLabel, SCENARIO_TEXT } from './scenarioText'

type AnnouncementTone = ScenarioAnnouncement['tone']

const message = (title: string, detail: string, tone?: AnnouncementTone, scene?: SceneId): ScenarioAnnouncement => ({
  title,
  detail,
  ...(tone ? { tone } : {}),
  ...(scene ? { scene } : {}),
})

const shareDetailScene = (announcement: ScenarioAnnouncement, detailScene: SceneId): ScenarioAnnouncement => ({
  ...announcement,
  detailScene,
  titleImageMode: 'same-as-detail-scene',
})

export const ANNOUNCEMENTS = {
  sideChange: SCENARIO_TEXT.defense.sideChange,
  playComplete: '플레이가 완료되었습니다.',
  playEnded: message('플레이 종료', '3아웃 · 공수교대입니다.', 'negative'),
  followUpOutfieldError: (clear: boolean) => message(
    '상대 외야수가 타구를 뒤로 빠뜨렸습니다.',
    clear ? '완전히 뒤로 빠졌습니다. 확실하게 진루할 수 있습니다.' : '애매하게 빠졌습니다. 진루를 시도하다가 아웃될 수도 있습니다.',
    clear ? 'positive' : 'caution',
    clear ? 'error-outfield-through-clear' : 'error-outfield-through-ambiguous',
  ),
  followUpOutfieldErrorByRunner: (runnerBase: 2 | 3, clear: boolean) => message(
    clear ? '상대 외야수가 타구를 완전히 뒤로 빠뜨렸습니다!' : '상대 외야수가 타구를 애매하게 뒤로 빠뜨렸습니다!',
    runnerBase === 2
      ? clear ? '2루 주자는 확실하게 진루할 수 있습니다.' : '2루 주자가 진루를 시도하다가 아웃될 수도 있습니다.'
      : clear ? '주자들이 한 베이스씩 진루했습니다. 3루 주자는 홈 진루를 선택할 수 있습니다.' : '주자들이 한 베이스씩 진루했습니다. 3루 주자는 홈 진루를 시도하다가 아웃될 수도 있습니다.',
    clear ? 'positive' : 'caution',
    clear ? 'error-outfield-through-clear' : 'error-outfield-through-ambiguous',
  ),
  outfieldError: (clear: boolean) => message(
    '상대 외야수가 타구를 뒤로 빠뜨렸습니다!',
    clear ? '완전히 뒤로 빠졌습니다. 확실하게 진루할 수 있습니다.' : '애매하게 빠졌습니다. 진루를 시도하다가 아웃될 수도 있습니다.',
    clear ? 'positive' : 'caution',
    clear ? 'error-outfield-through-clear' : 'error-outfield-through-ambiguous',
  ),
  wildPitchError: (clear: boolean) => message(
    '상대 포수가 공을 뒤로 빠뜨렸습니다!',
    clear ? '완전히 뒤로 빠졌습니다. 확실하게 진루할 수 있습니다.' : '애매하게 빠졌습니다. 진루를 시도하다가 아웃될 수도 있습니다.',
    clear ? 'positive' : 'caution',
    clear ? 'wild-pitch-clear' : 'wild-pitch-ambiguous',
  ),
  wildPitchStay: {
    clear: { ...message('폭투가 나왔지만 진루하지 않았습니다.', '명백히 진루 가능한 찬스를 놓쳤습니다.', 'negative'), advance: 'blocked' as const },
    ambiguous: { ...message('폭투가 나왔지만 진루하지 않았습니다.', '위험하다고 판단하여 진루하지 않았습니다.', 'neutral'), advance: 'blocked' as const },
  },
  wildPitchAdvance: {
    clear: { title: '폭투 진루 성공!', detail: SCENARIO_TEXT.advanceArrival, category: 'normal' as const, advance: 'normal' as const },
    ambiguous: { title: '폭투 진루 성공!', detail: SCENARIO_TEXT.riskyAdvanceSuccess, advance: 'bold' as const },
  },
  wildPitchAdvanceFailure: { title: '폭투 진루 실패', detail: '상대 포수의 좋은 송구로 {destination}에서 아웃되었습니다.', tone: 'negative' as const },
  groundFieldingSuccess: { ...message(SCENARIO_TEXT.defense.fieldingSuccess.title, SCENARIO_TEXT.defense.fieldingSuccess.detail), detailScene: 'ground-fielded', titleImageMode: 'same-as-detail-scene' as const },
  groundThrowSuccess: { ...message(SCENARIO_TEXT.defense.throwSuccess.title, SCENARIO_TEXT.defense.throwSuccess.detail), detailScene: 'ground-first-base-catch', titleImageMode: 'same-as-detail-scene' as const },
  infieldFieldingError: message('상대 내야수가 땅볼 포구에 실패했습니다!', '실책으로 1루에 출루했습니다.'),
  infieldFlyFieldingError: message('상대 내야수가 뜬공 포구에 실패했습니다!', '실책으로 타자 주자가 1루에 진출합니다.'),
  outfieldFieldingError: message('상대 외야수가 뜬공 포구에 실패했습니다!', '실책으로 타자 주자가 1루에 진출합니다.'),
  infieldFlyRule: SCENARIO_TEXT.defense.infieldFlyRule,
  followUpGroundOut: (playerBase: number | null, outs: number, playerIsForced: boolean) => {
    const forceOutBase = getPlayerDestinationLabel(playerBase)
    if (playerIsForced) {
      return shareDetailScene(message(
        '내야 땅볼 포스 아웃!',
        `후속 타자의 내야 땅볼로 인해 ${forceOutBase}에서 포스 아웃되었습니다.${outs >= 3 ? ` ${ANNOUNCEMENTS.sideChange}` : ''}`,
        'negative',
      ), 'out-ground-force')
    }
    if (playerBase === 3 && outs < 3) return { ...message('상대 내야수, 1루 송구 준비 완료!', '3루 주자는 위험을 감수하고 송구 시점에 맞춰 홈 쇄도를 시도할 수 있습니다.', 'caution'), detailScene: 'ground-throw-ready', titleImageMode: 'same-as-detail-scene' as const }
    if (playerBase === 2) return shareDetailScene(message('후속타자의 내야 땅볼, 정상 수비!', '내야수 송구 순간 3루 진루를 시도할 수 있습니다.'), 'ground-throw-ready')
    return shareDetailScene(message('후속타자의 내야 땅볼 아웃!', outs >= 3 ? ANNOUNCEMENTS.sideChange : '현재 베이스에 머뭅니다.'), 'ground-first-base-catch')
  },
  groundLeadRunnerOut: (outs: number, isForced: boolean) => message(
    isForced ? '내야 땅볼 포스 아웃!' : '내야 땅볼 선행 주자 아웃!',
    outs >= 3 ? ANNOUNCEMENTS.sideChange : '선행 주자가 아웃되고 타자 주자가 1루에 진출했습니다.',
    'negative',
  ),
  groundForceOut: (outs: number) => ANNOUNCEMENTS.groundLeadRunnerOut(outs, true),
  groundThrowingErrorClear: { ...message(SCENARIO_TEXT.defense.throwingErrorClear.title, SCENARIO_TEXT.defense.throwingErrorClear.detail, 'positive', 'error-first-base-catch-clear') },
  groundThrowingErrorAmbiguous: { ...message(SCENARIO_TEXT.defense.throwingErrorAmbiguous.title, SCENARIO_TEXT.defense.throwingErrorAmbiguous.detail, 'caution', 'error-first-base-catch-ambiguous') },
  followUpGroundThrowingErrorClear: shareDetailScene(message('내야 땅볼 송구 실책!', '1루수 뒤로 송구가 완전히 빠졌습니다. 추가 진루를 시도할 수 있습니다.', 'positive'), 'error-first-base-catch-clear'),
  followUpGroundThrowingErrorAmbiguous: shareDetailScene(message('내야 땅볼 송구 실책!', '1루수 뒤로 송구가 빠졌습니다. 추가 진루를 시도할 수 있습니다.', 'caution'), 'error-first-base-catch-ambiguous'),
  followUpGroundThrowingErrorExtraAdvanceAttempt: {
    clear: shareDetailScene(message('내야 땅볼 송구 실책!', '1루수 뒤로 송구가 완전히 빠지며 타자 주자가 1루에서 세이프입니다.', 'positive'), 'error-first-base-catch-clear'),
    ambiguous: shareDetailScene(message('내야 땅볼 송구 실책!', '1루수 뒤로 송구가 애매하게 빠지며 타자 주자가 1루에서 세이프입니다.', 'caution'), 'error-first-base-catch-ambiguous'),
  },
  followUpGroundThrowingErrorExtraAdvance: {
    clear: {
      title: '홈 추가 진루 성공!',
      detail: '이미 스타트를 끊은 상태에서 1루수 뒤로 송구가 완전히 빠져 {destination} 추가 진루에 성공했습니다.',
      homeDetail: '이미 스타트를 끊은 상태에서 1루수 뒤로 송구가 완전히 빠져 {destination}에 들어왔습니다.',
      advance: 'bold' as const,
      detailScene: 'error-first-base-catch-clear',
      titleImageMode: 'same-as-detail-scene' as const,
    },
    ambiguous: {
      title: '홈 추가 진루 성공!',
      detail: '이미 스타트를 끊은 상태에서 1루수 뒤로 송구가 애매하게 빠져 {destination} 추가 진루에 성공했습니다.',
      homeDetail: '이미 스타트를 끊은 상태에서 1루수 뒤로 송구가 애매하게 빠져 {destination}에 들어왔습니다.',
      advance: 'bold' as const,
      detailScene: 'error-first-base-catch-ambiguous',
      titleImageMode: 'same-as-detail-scene' as const,
    },
  },
  groundThrowingErrorAdvance: {
    clear: {
      title: '내야 땅볼 송구 실책 추가 진루 성공!',
      detail: '송구 실책을 이용해 {destination}에 도착했습니다.',
      category: 'normal' as const,
      advance: 'normal' as const,
      detailScene: 'error-first-base-catch-clear',
      titleImageMode: 'same-as-detail-scene' as const,
    },
    ambiguous: {
      title: '내야 땅볼 송구 실책 추가 진루 성공!',
      detail: '위험을 감수하고 {destination} 추가 진루에 성공했습니다.',
      advance: 'bold' as const,
      detailScene: 'error-first-base-catch-ambiguous',
      titleImageMode: 'same-as-detail-scene' as const,
    },
  },
  groundDoublePlay: (outs: number) => message('내야 땅볼 병살!', outs >= 3 ? ANNOUNCEMENTS.sideChange : '1루 주자와 타자 주자가 모두 아웃되었습니다.', 'negative'),
  followUpBattingEvent: (title: string, before: number | null, playerBase: number | null, outs: number) => {
    if (outs >= 3) return message(title, ANNOUNCEMENTS.sideChange, 'negative')
    const stayed = before !== null && playerBase !== null && playerBase === before
    const detail = before === null || playerBase === null
      ? '홈에 들어왔습니다.'
      : stayed
        ? `${getPlayerBaseLabel(before)}에서 움직이지 못했습니다.`
        : `${getPlayerBaseLabel(playerBase)}에 도착했습니다.`
    if (playerBase === null) return message(title, detail, 'neutral')
    return { ...message(title, detail), advance: stayed ? 'blocked' as const : 'normal' as const }
  },
} as const