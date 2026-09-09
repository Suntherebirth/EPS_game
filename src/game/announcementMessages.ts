import type { ScenarioAnnouncement } from './scenario'

type AnnouncementTone = ScenarioAnnouncement['tone']

const message = (title: string, detail: string, tone?: AnnouncementTone): ScenarioAnnouncement => ({
  title,
  detail,
  ...(tone ? { tone } : {}),
})

export const ANNOUNCEMENTS = {
  sideChange: '3아웃 · 공수교대입니다.',
  playComplete: '플레이가 완료되었습니다.',
  playEnded: message('플레이 종료', '3아웃 · 공수교대입니다.', 'negative'),
  followUpOutfieldError: (clear: boolean) => message(
    '외야수가 타구를 뒤로 빠뜨렸습니다.',
    clear ? '완전히 뒤로 빠졌습니다. 확실하게 진루할 수 있습니다.' : '애매하게 빠졌습니다. 진루를 시도하다가 아웃될 수도 있습니다.',
    clear ? 'positive' : 'caution',
  ),
  followUpGroundOut: (playerBase: number | null, outs: number, playerIsForced: boolean) => {
    const forceOutBase = playerBase === 3 ? '홈' : `${(playerBase ?? 0) + 1}루`
    if (playerIsForced) {
      return message(
        '내야 땅볼 포스 아웃!',
        `후속 타자의 내야 땅볼로 인해 ${forceOutBase}에서 포스 아웃되었습니다.${outs >= 3 ? ` ${ANNOUNCEMENTS.sideChange}` : ''}`,
        'negative',
      )
    }
    if (playerBase === 3 && outs < 3) return message('상대 내야수, 1루 송구 준비 완료!', '3루 주자는 송구 시점에 맞춰 홈 쇄도를 시도할 수 있습니다.')
    if (playerBase === 2) return message('후속타자의 내야 땅볼, 정상 수비!', '내야수 송구 순간 3루 진루를 시도할 수 있습니다.')
    return message('후속타자의 내야 땅볼 아웃!', outs >= 3 ? ANNOUNCEMENTS.sideChange : '현재 베이스에 머뭅니다.')
  },
  groundForceOut: (outs: number) => message('내야 땅볼 포스 아웃!', outs >= 3 ? ANNOUNCEMENTS.sideChange : '선행 주자가 아웃되고 타자 주자가 1루에 진출했습니다.', 'negative'),
  groundDoublePlay: (outs: number) => message('내야 땅볼 병살!', outs >= 3 ? ANNOUNCEMENTS.sideChange : '1루 주자와 타자 주자가 모두 아웃되었습니다.', 'negative'),
  followUpBattingEvent: (title: string, before: number | null, playerBase: number | null, outs: number) => {
    if (outs >= 3) return message(title, ANNOUNCEMENTS.sideChange, 'negative')
    const detail = before === null || playerBase === null
      ? '홈에 들어왔습니다.'
      : playerBase === before
        ? `${before}루에서 움직이지 못했습니다.`
        : `${playerBase}루에 도착했습니다.`
    return message(title, detail, playerBase === null ? 'positive' : undefined)
  },
} as const