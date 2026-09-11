export const SCENARIO_TEXT = {
	advanceChoice: '{destination}로 진루한다',
	advanceAttemptChoice: '{destination}로 진루를 시도한다',
	advanceQuestion: '{destination}로 진루할까요?',
	advanceArrival: '{destination}에 도착했습니다.',
	riskyAdvanceSuccess: '위험을 감수하고 {destination} 추가 진루에 성공했습니다.',
	batting: {
		single: { title: '1루타 성공!', detail: '1루에 도착했습니다.' },
		double: { title: '2루타 성공!', detail: '2루에 도착했습니다.' },
		triple: { title: '3루타 성공!', detail: '3루에 도착했습니다.' },
		walk: { title: '볼넷!', detail: '1루에 도착했습니다.' },
		hitByPitch: { title: '사구!', detail: '1루에 도착했습니다.' },
		homeRun: { title: '홈런!', detail: '타자와 모든 주자가 홈에 들어왔습니다.' },
	},
	steal: {
		secondSuccess: { title: '2루 도루 성공!', detail: '2루에 도착했습니다.' },
		thirdSuccess: { title: '3루 도루 성공!', detail: '3루에 도착했습니다.' },
			secondFailure: { title: '2루 도루 실패', detail: '2루에서 아웃되었습니다.' },
			thirdFailure: { title: '3루 도루 실패', detail: '3루에서 아웃되었습니다.' },
	},
	running: {
		tagUpSuccess: { title: '태그업 성공!', detail: '3루 주자가 홈에 들어왔습니다.' },
		tagUpSafeSuccess: { title: '태그업 성공!', detail: '3루 주자가 홈에 안전하게 들어왔습니다.' },
		advanceThirdSuccess: { title: '3루 진루 성공!', detail: '3루에 도착했습니다.' },
		homeAdvanceSuccess: { title: '내야 땅볼 중 홈 추가진루 성공!', detail: '송구를 받은 상대 1루수가 홈에 던졌지만, 3루 주자가 먼저 홈 쇄도에 성공했습니다.' },
		battedBallHomeAdvance: { title: '내야 땅볼 타자 아웃, 3루 주자 홈 쇄도 성공!', detail: '타자 주자는 1루에서 아웃됐지만 3루 주자가 홈에 들어왔습니다.' },
		leadRunnerHomeAdvance: { title: '내야 땅볼 선행 주자 아웃, 3루 주자 홈 쇄도 성공!', detail: '1루 주자가 아웃된 사이 3루 주자가 홈에 들어왔습니다.' },
		thirdBaseFailure: { title: '3루 진루 실패', detail: '3루에서 아웃되었습니다.' },
		homeAdvanceFailure: { title: '홈 진루 실패', detail: '홈에서 아웃되었습니다.' },
		tagUpFailure: { title: '위험을 감수한 태그업 실패', detail: '3루 주자가 홈에서 아웃되었습니다.' },
	},
		defense: {
			sideChange: '3아웃 · 공수교대입니다.',
			fieldingSuccess: { title: '상대 내야수가 땅볼 포구에 성공했습니다!', detail: '1루 송구를 준비합니다.' },
			throwSuccess: { title: '상대 내야수가 1루 송구에 성공했습니다!', detail: '타자 주자를 1루에서 처리합니다.' },
			throwingErrorClear: { title: '내야 땅볼 송구 실책!', detail: '1루수 뒤로 송구가 완전히 빠졌습니다.\n확실하게 추가 진루할 수 있습니다.' },
			throwingErrorAmbiguous: { title: '내야 땅볼 송구 실책!', detail: '1루수 뒤로 송구가 애매하게 빠졌습니다.\n추가 진루를 시도해서 성공하면 점수를 얻습니다.\n실패하여 아웃되면 점수를 잃습니다.' },
			nextBaseOut: '{destination}에서 아웃되었습니다.',
			homeOut: '홈에서 아웃되었습니다.',
			strikeout: { title: '삼진 아웃되었습니다.', detail: '아웃 카운트가 올라갔습니다.' },
			infieldFlyRule: { title: '인필드 플라이 선언!', detail: '타자 아웃. 주자는 원래 베이스에 머뭅니다.' },
			infieldFlyOut: { title: '뜬공 처리 성공!', detail: '플레이가 완료되었습니다.' },
			groundOut: { title: '땅볼 처리 성공!', detail: '플레이가 완료되었습니다.' },
			flyOut: { title: '뜬공 처리 성공!', detail: '플레이가 완료되었습니다.' },
			flyOutChoice: '뜬공 처리 성공',
		},
} as const

export const getPlayerBaseLabel = (playerBase: number | null) => playerBase === null ? '홈' : `${playerBase}루`

export const getPlayerDestinationLabel = (playerBase: number | null) => playerBase === 3 ? '홈' : `${(playerBase ?? 0) + 1}루`

export const formatScenarioText = (text: string | undefined, playerBase: number | null) => {
	if (!text) return text
	const destination = getPlayerDestinationLabel(playerBase)
	return text.replaceAll('{destination}로', destination === '홈' ? '홈으로' : `${destination}로`).replaceAll('{destination}', destination)
}

export const formatCurrentPlayerText = (text: string | undefined, playerBase: number | null) => text?.replaceAll('{destination}', getPlayerBaseLabel(playerBase))

export const formatScenarioAdvanceFailureText = (text: string, playerBase: number | null) => text.replaceAll('{destination}', getPlayerDestinationLabel(playerBase))
