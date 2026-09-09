import { Bug, CheckCircle2, ChevronRight, Pause, Play, RotateCcw, SkipBack, SkipForward, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createAnnouncementAuditCases, findMatchingCaseId, replayAnnouncementCase, type AnnouncementAuditCase, type AnnouncementReplayFrame } from './game/announcementAudit'
import { BATTING_EVENTS, type BattingEventId } from './game/battingEvents'
import {
  createRandomSituation,
  createScenarioContext,
  describeBases,
  describeSituation,
  type Base,
  type Situation,
} from './game/gameSetup'
import { OFFENSE_CORE_PACK } from './game/packs/offenseCorePack'
import { chooseScenarioChanceOutcome, chooseScenarioOption, getAvailableScenarioChoices, selectScenarioBattingEvent, settleScenario, startScenario } from './game/scenarioEngine'
import type { ScenarioState } from './game/scenario'
import viewBatter from './assets/scenes/view-batter.png'
import viewRunnerFirst from './assets/scenes/view-runner-first.png'
import viewRunnerSecond from './assets/scenes/view-runner-second.png'
import viewRunnerThird from './assets/scenes/view-runner-third.png'
import './App.css'

const VIEW_IMAGES: Record<string, string> = {
  batter: viewBatter,
  'runner:first': viewRunnerFirst,
  'runner:second': viewRunnerSecond,
  'runner:third': viewRunnerThird,
}

type Phase = 'playing' | 'between' | 'finished'
type AppMode = 'game' | 'announcementCheck'
type AnnouncementAuditStatus = 'needsReview' | 'ok'
type AnnouncementAuditTab = 'pending' | 'all' | 'needsReview' | 'ok'
type RecordEntry = { number: number; situation: string; decision: string; result: string; runs: number }
type Stats = { runs: number; hits: number; outs: number }

const ANNOUNCEMENT_AUDIT_STORAGE_KEY = 'eps:announcement-check:completed:v1'
const ANNOUNCEMENT_AUDIT_TAB_STORAGE_KEY = 'eps:announcement-check:tab:v1'

const loadAnnouncementCaseStatuses = () => {
  try {
    const value = localStorage.getItem(ANNOUNCEMENT_AUDIT_STORAGE_KEY)
    const parsed = value ? JSON.parse(value) : {}
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.filter((item): item is string => typeof item === 'string').map((id) => [id, 'ok' as const]))
    }
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, AnnouncementAuditStatus] => entry[1] === 'needsReview' || entry[1] === 'ok'))
  } catch {
    return {}
  }
}

const saveAnnouncementCaseStatuses = (statuses: Record<string, AnnouncementAuditStatus>) => {
  localStorage.setItem(ANNOUNCEMENT_AUDIT_STORAGE_KEY, JSON.stringify(statuses))
}

const loadAnnouncementAuditTab = (): AnnouncementAuditTab => {
  const value = localStorage.getItem(ANNOUNCEMENT_AUDIT_TAB_STORAGE_KEY)
  return value === 'all' || value === 'needsReview' || value === 'ok' ? value : 'pending'
}

const saveAnnouncementAuditTab = (tab: AnnouncementAuditTab) => {
  localStorage.setItem(ANNOUNCEMENT_AUDIT_TAB_STORAGE_KEY, tab)
}

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

const formatAnnouncementBugReport = (item: AnnouncementAuditCase) => {
  const messages = item.messages.map((message, index) => [
    `${index + 1}. ${message.title}`,
    `   detail: ${message.detail}`,
    `   tone: ${message.tone ?? 'neutral'}, category: ${message.category}`,
  ].join('\n')).join('\n')

  return [
    'EPS Baseball Sim 아나운스 텍스트 버그 리포트',
    '',
    `상황: ${item.situation}`,
    `표시 시점: ${item.viewLabel}${item.isSurprise ? ' / 돌발 이벤트' : ''}`,
    `플레이 흐름: ${item.actionLabel}`,
    `주자 상태: outs=${item.outs}, bases=[${item.bases.join(', ')}], playerBase=${item.playerBase ?? 'none'}`,
    '',
    '현재 화면에 이렇게 표시됩니다:',
    messages,
    '',
    '이 상황에 맞게 더 자연스러운 한국어 아나운스 문구로 수정하려고 합니다.',
    '관련 코드는 위 title/detail 문구를 기준으로 src/game/announcementMessages.ts, src/game/scenarioEffects.ts, src/game/packs/offenseCorePack.ts, src/game/packs/emptyBasesSingleNodes.ts 쪽에서 찾으면 됩니다.',
  ].join('\n')
}

function BaseDiamond({ bases, playerBase }: { bases: Base[]; playerBase?: number | null }) {
  return <div className="diamond" aria-label={describeBases(bases)}>
    <span className={`base base-second ${bases.includes(2) ? 'occupied' : ''} ${playerBase === 2 ? 'player-base' : ''}`} />
    <span className={`base base-third ${bases.includes(3) ? 'occupied' : ''} ${playerBase === 3 ? 'player-base' : ''}`} />
    <span className={`base base-first ${bases.includes(1) ? 'occupied' : ''} ${playerBase === 1 ? 'player-base' : ''}`} />
  </div>
}

function MediaStage({ situation, plateAppearance, playerBase, viewLabel, isSurpriseEvent, isPlateEntry, videoUrl, imageUrl }: { situation: Situation; plateAppearance: number; playerBase: number | null; viewLabel?: string | null; isSurpriseEvent?: boolean; isPlateEntry?: boolean; videoUrl?: string; imageUrl?: string }) {
  return <section className="media-stage" aria-live="polite">
    {videoUrl && <video src={videoUrl} autoPlay muted playsInline controls />}
    {!videoUrl && imageUrl && <img src={imageUrl} alt="" />}
    {viewLabel && <div className={`media-view-label ${isSurpriseEvent ? 'surprise-chip' : ''}`}>{viewLabel}</div>}
    <div className={`broadcast-bug ${isPlateEntry ? 'plate-entry-flash' : ''}`}>
      <div className="broadcast-plate"><span>공격</span><strong>{plateAppearance}<small>/3</small></strong></div>
      <div className="broadcast-runners"><BaseDiamond bases={situation.bases} playerBase={playerBase} /></div>
      <div className="broadcast-outs"><span>OUT</span><div>{[0, 1, 2].map((out) => <i className={out < situation.outs ? 'on' : ''} key={out} />)}</div></div>
    </div>
  </section>
}

function AnnouncementCheckMode({ cases, caseStatuses, activeTab, highlightedCaseId, onChangeTab, onSetStatus, onSimulate, onBack }: { cases: AnnouncementAuditCase[]; caseStatuses: Record<string, AnnouncementAuditStatus>; activeTab: AnnouncementAuditTab; highlightedCaseId: string | null; onChangeTab: (tab: AnnouncementAuditTab) => void; onSetStatus: (id: string, status: AnnouncementAuditStatus | null) => void; onSimulate: (item: AnnouncementAuditCase) => void; onBack: () => void }) {
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null)
  const visibleCases = activeTab === 'all' ? cases : cases.filter((item) => activeTab === 'pending' ? !caseStatuses[item.id] : caseStatuses[item.id] === activeTab)
  const pendingCount = cases.filter((item) => !caseStatuses[item.id]).length
  const needsReviewCount = cases.filter((item) => caseStatuses[item.id] === 'needsReview').length
  const okCount = cases.filter((item) => caseStatuses[item.id] === 'ok').length

  useEffect(() => {
    if (!highlightedCaseId) return
    document.getElementById(`audit-card:${highlightedCaseId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightedCaseId])

  const copyBugReport = async (item: AnnouncementAuditCase) => {
    await copyTextToClipboard(formatAnnouncementBugReport(item))
    setCopiedReportId(item.id)
    window.setTimeout(() => setCopiedReportId((current) => current === item.id ? null : current), 1600)
  }

  return <main className="app-shell audit-page">
    <header className="brand-bar audit-header"><button className="brand-title" type="button" onClick={onBack}><b className="brand-mark">EPS</b><span>BASEBALL SIM</span></button><div className="header-controls"><button className="icon-button" type="button" onClick={onBack} title="게임으로 돌아가기" aria-label="게임으로 돌아가기"><RotateCcw size={18} /></button></div></header>
    <section className="audit-summary">
      <p className="eyebrow">ANNOUNCEMENT CHECK</p>
      <h1>아나운스 텍스트 체크</h1>
      <p>같은 표시 상황과 같은 메시지 흐름은 하나로 묶었습니다.</p>
      <div className="audit-metrics"><div><strong>{cases.length}</strong><span>전체</span></div><div><strong>{pendingCount}</strong><span>미판정</span></div><div><strong>{needsReviewCount}</strong><span>검토 필요</span></div><div><strong>{okCount}</strong><span>문제 없음</span></div></div>
      <div className="audit-tabs" role="tablist" aria-label="아나운스 체크 필터">
        <button className={activeTab === 'pending' ? 'active' : ''} type="button" role="tab" aria-selected={activeTab === 'pending'} onClick={() => onChangeTab('pending')}>미판정</button>
        <button className={activeTab === 'all' ? 'active' : ''} type="button" role="tab" aria-selected={activeTab === 'all'} onClick={() => onChangeTab('all')}>전체보기</button>
        <button className={activeTab === 'needsReview' ? 'active' : ''} type="button" role="tab" aria-selected={activeTab === 'needsReview'} onClick={() => onChangeTab('needsReview')}>검토필요</button>
        <button className={activeTab === 'ok' ? 'active' : ''} type="button" role="tab" aria-selected={activeTab === 'ok'} onClick={() => onChangeTab('ok')}>문제없음</button>
      </div>
    </section>
    <section className="audit-list" aria-label="아나운스 체크 목록">
      {visibleCases.map((item) => {
        const status = caseStatuses[item.id]
        return <article className={`audit-card ${status ?? ''} ${item.isSurprise ? 'surprise' : ''} ${highlightedCaseId === item.id ? 'highlighted' : ''}`} key={item.id} id={`audit-card:${item.id}`}>
          <div className="audit-card-meta"><span>{item.situation}</span><span>{item.viewLabel}</span>{item.isSurprise && <b>돌발 이벤트</b>}{status === 'needsReview' && <b className="review-chip">검토 필요</b>}{status === 'ok' && <b className="ok-chip">문제 없음</b>}</div>
          <div className="audit-message-flow">
            {item.messages.map((message, index) => <div className={`audit-message ${message.category === 'surprise' ? 'surprise-message' : ''} ${message.tone ?? 'neutral'}`} key={`${message.title}:${message.detail}:${index}`}>
              {index > 0 && <span>그리고</span>}
              <strong>{message.title}</strong>
              <p>{message.detail}</p>
            </div>)}
          </div>
          <div className="audit-card-footer"><small>{item.actionLabel}</small><div className="audit-card-actions"><button className="secondary-button" type="button" onClick={() => onSimulate(item)}><Play size={16} /> 시뮬레이션</button><button className="secondary-button" type="button" onClick={() => void copyBugReport(item)}><Bug size={16} /> {copiedReportId === item.id ? '복사됨' : '버그 리포트'}</button><button className={status === 'needsReview' ? 'primary-button review-button' : 'secondary-button review-button'} type="button" onClick={() => onSetStatus(item.id, status === 'needsReview' ? null : 'needsReview')}>검토 필요</button><button className={status === 'ok' ? 'primary-button ok-button' : 'secondary-button ok-button'} type="button" onClick={() => onSetStatus(item.id, status === 'ok' ? null : 'ok')}>{status === 'ok' ? '문제 없음 해제' : <><CheckCircle2 size={17} /> 문제 없음</>}</button></div></div>
        </article>
      })}
      {visibleCases.length === 0 && <div className="audit-empty"><strong>해당 탭에 아나운스가 없습니다.</strong><p>전체보기에서 항목을 검토 필요 또는 문제 없음으로 표시할 수 있습니다.</p></div>}
    </section>
  </main>
}

function App() {
  const [appMode, setAppMode] = useState<AppMode>('game')
  const [adminMode, setAdminMode] = useState(false)
  const [announcementAuditCases] = useState(() => createAnnouncementAuditCases())
  const [announcementCaseStatuses, setAnnouncementCaseStatuses] = useState<Record<string, AnnouncementAuditStatus>>(() => loadAnnouncementCaseStatuses())
  const [announcementAuditTab, setAnnouncementAuditTabState] = useState<AnnouncementAuditTab>(() => loadAnnouncementAuditTab())
  const [highlightedAuditCaseId, setHighlightedAuditCaseId] = useState<string | null>(null)
  const [replay, setReplay] = useState<{ frames: AnnouncementReplayFrame[]; index: number; playing: boolean } | null>(null)
  const [plateAppearance, setPlateAppearance] = useState(1)
  const [phase, setPhase] = useState<Phase>('playing')
  const [situation, setSituation] = useState<Situation>(() => createRandomSituation())
  const [scenario, setScenario] = useState<ScenarioState>(() => startScenario(OFFENSE_CORE_PACK, createScenarioContext(situation), { manualChance: adminMode }))
  const [stats, setStats] = useState<Stats>({ runs: 0, hits: 0, outs: 0 })
  const [records, setRecords] = useState<RecordEntry[]>([])

  const replayFrame = replay ? replay.frames[replay.index] : null
  const displayedState = replayFrame?.state ?? scenario

  useEffect(() => {
    if (!replay?.playing || replay.index >= replay.frames.length - 1) return
    const timer = window.setTimeout(() => {
      setReplay((current) => {
        if (!current || !current.playing) return current
        if (current.index >= current.frames.length - 2) return { ...current, index: current.frames.length - 1, playing: false }
        return { ...current, index: current.index + 1 }
      })
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [replay?.playing, replay?.index, replay?.frames.length])

  const restartAt = (nextSituation: Situation) => {
    setSituation(nextSituation)
    setScenario(startScenario(OFFENSE_CORE_PACK, createScenarioContext(nextSituation), { manualChance: adminMode }))
    setPhase('playing')
  }

  const resetGame = () => {
    setPlateAppearance(1)
    setStats({ runs: 0, hits: 0, outs: 0 })
    setRecords([])
    setReplay(null)
    restartAt(createRandomSituation())
  }

  const completeScenario = (state: ScenarioState) => {
    const result = state.context.completionRecords.join('\n') || state.context.selectedLabel || '플레이 완료'
    setStats((current) => ({
      runs: current.runs + state.context.runs,
      hits: current.hits + state.context.hits,
      outs: current.outs + Math.max(0, state.context.outs - situation.outs),
    }))
    setSituation({ outs: state.context.outs, bases: state.context.bases as Base[] })
    setRecords((current) => [...current, {
      number: plateAppearance,
      situation: describeSituation(situation),
      decision: state.context.selectedLabel ?? '타격',
      result,
      runs: state.context.runs,
    }])
    setScenario(state)
    setPhase('between')
  }

  const acceptState = (next: ScenarioState) => {
    const terminal = OFFENSE_CORE_PACK.nodes[next.nodeId].type === 'terminal'
    setScenario(next)
    if (terminal) completeScenario(next)
  }

  const chooseBatting = (eventId: BattingEventId) => acceptState(selectScenarioBattingEvent(OFFENSE_CORE_PACK, scenario, eventId, { manualChance: adminMode }))
  const chooseOption = (choiceId: string) => acceptState(chooseScenarioOption(OFFENSE_CORE_PACK, scenario, choiceId, { manualChance: adminMode }))
  const chooseChanceOutcome = (outcomeId: string) => acceptState(chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, scenario, outcomeId, { manualChance: adminMode }))
  const toggleAdminMode = (enabled: boolean) => {
    setAdminMode(enabled)
    if (!enabled && OFFENSE_CORE_PACK.nodes[scenario.nodeId].type === 'chance') {
      acceptState(settleScenario(OFFENSE_CORE_PACK, scenario))
    }
  }

  const setAnnouncementCaseStatus = (id: string, status: AnnouncementAuditStatus | null) => {
    setAnnouncementCaseStatuses((current) => {
      const next = { ...current }
      if (status) next[id] = status
      else delete next[id]
      saveAnnouncementCaseStatuses(next)
      return next
    })
  }

  const setAnnouncementAuditTab = (tab: AnnouncementAuditTab) => {
    saveAnnouncementAuditTab(tab)
    setAnnouncementAuditTabState(tab)
  }

  const openAuditFromGame = () => {
    const matchedId = findMatchingCaseId(scenario)
    setReplay(null)
    setHighlightedAuditCaseId(matchedId)
    if (matchedId) setAnnouncementAuditTab('all')
    setAppMode('announcementCheck')
  }

  const simulateAuditCase = (item: AnnouncementAuditCase) => {
    const frames = replayAnnouncementCase(item)
    const last = frames.at(-1)!.state
    setAdminMode(true)
    setAppMode('game')
    setSituation({ outs: last.context.outs, bases: last.context.bases as Base[] })
    setScenario(last)
    setPhase('playing')
    setReplay({ frames, index: 0, playing: false })
    setHighlightedAuditCaseId(item.id)
  }

  const continueGame = () => {
    setReplay(null)
    if (plateAppearance === 3) {
      setPhase('finished')
      return
    }
    setPlateAppearance((current) => current + 1)
    restartAt(createRandomSituation())
  }

  if (appMode === 'announcementCheck') return <AnnouncementCheckMode cases={announcementAuditCases} caseStatuses={announcementCaseStatuses} activeTab={announcementAuditTab} highlightedCaseId={highlightedAuditCaseId} onChangeTab={setAnnouncementAuditTab} onSetStatus={setAnnouncementCaseStatus} onSimulate={simulateAuditCase} onBack={() => setAppMode('game')} />

  if (phase === 'finished') return <main className="app-shell result-page">
    <header className="brand-bar"><span><b className="brand-mark">EPS</b> BASEBALL SIM</span></header>
    <section className="result-hero"><p className="eyebrow">FINAL REPORT</p><h1>공격 시뮬레이션 종료</h1><p>세 번의 선택이 만든 경기 결과입니다.</p>
      <div className="final-score"><div><strong>{stats.runs}</strong><span>득점</span></div><div><strong>{stats.hits}</strong><span>안타</span></div><div><strong>{stats.outs}</strong><span>아웃</span></div></div>
    </section>
    <section className="record-list">{records.map((record) => <article className="record-row" key={record.number}>
      <span className="record-number">0{record.number}</span><div><strong>{record.decision}</strong><small>{record.situation}</small></div><p>{record.result}</p><b className={record.runs ? 'scored' : ''}>+{record.runs}</b>
    </article>)}</section>
    <button className="primary-button restart" type="button" onClick={resetGame}><RotateCcw size={18} /> 새 경기</button>
  </main>

  const node = OFFENSE_CORE_PACK.nodes[displayedState.nodeId]
  const replaying = replay !== null
  const replayAtEnd = replay ? replay.index === replay.frames.length - 1 : false
  const isPlateEntry = phase === 'playing' && node.type === 'batting' && !replaying
  const displayedSituation = { outs: displayedState.context.outs, bases: displayedState.context.bases as Base[] }
  const nodeViewBase = node.view === 'runner:first' ? 1 : node.view === 'runner:second' ? 2 : node.view === 'runner:third' ? 3 : null
  const currentViewBase = node.tags?.includes('player-position-view') && nodeViewBase === 1 ? displayedState.context.playerBase : nodeViewBase
  const imageView = currentViewBase ? `runner:${currentViewBase === 1 ? 'first' : currentViewBase === 2 ? 'second' : 'third'}` : node.view
  const viewLabel = node.view.startsWith('runner:') && currentViewBase
    ? `${currentViewBase}루 주자 시점`
    : node.view === 'batter' ? '타석 시점' : null
  const isSurpriseEvent = node.tags?.includes('surprise-event')
  const highlightedViewLabel = replaying && replayFrame
    ? `재생 ${replay.index + 1}/${replay.frames.length} · ${viewLabel ?? '결과'}`
    : isSurpriseEvent && viewLabel ? `${viewLabel} : 돌발 이벤트!` : viewLabel
  const availableChoices = getAvailableScenarioChoices(OFFENSE_CORE_PACK, scenario)
  const choiceDescription = node.type === 'choice' && isSurpriseEvent && currentViewBase
    ? `${currentViewBase}루 주자: 돌발 상황 대처`
    : node.type === 'choice' && node.tags?.includes('player-position-view') && currentViewBase && node.description
    ? node.description.startsWith(`${currentViewBase}루 주자:`) ? node.description : `${currentViewBase}루 주자: ${node.description}`
    : node.type === 'choice' ? node.description : undefined
  const announcementMessages = displayedState.context.announcement
    ? [
        ...displayedState.context.announcementHistory.map((entry) => ({ ...entry.announcement, category: entry.category })),
        { ...displayedState.context.announcement, category: displayedState.context.announcementCategory },
      ]
    : []
  const announcementRenderKey = `${displayedState.context.announcementHistory.length}:${displayedState.context.announcement?.title ?? ''}:${displayedState.context.announcement?.detail ?? ''}`
  const actionInstruction = node.type === 'batting'
    ? adminMode && node.mode === 'random' ? '관리자: 후속 타자 결과를 지정하세요.' : '타격 결과를 선택해주세요.'
    : node.type === 'choice'
      ? choiceDescription ?? '주루 방침을 선택해주세요.'
      : node.type === 'chance' && adminMode
        ? '관리자: 확률 결과를 지정하세요.'
      : ''

  return <main className="app-shell">
    <header className="brand-bar"><button className="brand-title audit-entry-enabled" type="button" onClick={openAuditFromGame} aria-label="아나운스 텍스트 체크 모드 열기"><b className="brand-mark">EPS</b><span>BASEBALL SIM</span></button><div className="header-controls">{replay && <button className="secondary-button audit-return-button" type="button" onClick={() => setAppMode('announcementCheck')}>체크로 돌아가기</button>}{findMatchingCaseId(scenario) && <button className="secondary-button" type="button" onClick={openAuditFromGame}><Bug size={14} /> 이 텍스트 체크하기</button>}<label className="admin-toggle"><SlidersHorizontal size={14} /><span>관리자</span><input type="checkbox" checked={adminMode} onChange={(event) => toggleAdminMode(event.target.checked)} aria-label="관리자 콘솔" /><i /></label><button className="icon-button" type="button" onClick={resetGame} title="새 경기" aria-label="새 경기"><RotateCcw size={18} /></button></div></header>
    <div className="game-grid">
      <MediaStage situation={displayedSituation} plateAppearance={plateAppearance} playerBase={displayedState.context.playerBase} viewLabel={highlightedViewLabel} isSurpriseEvent={isSurpriseEvent} isPlateEntry={isPlateEntry} imageUrl={VIEW_IMAGES[imageView]} />
      <section className={`decision-panel ${isPlateEntry ? 'plate-entry-panel' : ''} ${isSurpriseEvent ? 'surprise-event-panel' : ''} ${displayedState.context.announcement ? 'has-announcement' : ''} ${announcementMessages.length > 1 ? 'has-compound-announcement' : ''}`}>
        {displayedState.context.announcement && <aside className={`result-notice ${displayedState.context.announcement.tone ?? 'neutral'}`} aria-live="polite" key={`${displayedState.context.announcement.title}:${displayedState.context.announcement.detail}:${replayFrame?.stepIndex ?? 'live'}`}>
          <span>{replaying ? '아나운스 재생' : '방금 일어난 일'}</span>
          <div className="message-flow">
            {announcementMessages.map((message, index) => <div className="message-flow-entry" key={`${message.title}:${message.detail}:${index}`}>
              {index > 0 && <span className="message-flow-connector" style={{ animationDelay: `${0.5 + (index - 1) * 0.68}s` }}>그리고</span>}
              <div className={`message-flow-message ${message.category === 'surprise' ? 'surprise-message' : 'normal-message'} ${message.tone ?? 'neutral'}`} style={{ animationDelay: `${0.16 + index * 0.68}s` }}>
                <strong>{message.title}</strong>
                <p>{message.detail}</p>
              </div>
            </div>)}
          </div>
        </aside>}
        {phase === 'playing' && actionInstruction && <p className={`action-instruction ${node.type === 'choice' ? 'choice-instruction' : ''}`} key={`${displayedState.nodeId}:${actionInstruction}:${announcementRenderKey}`}>{replaying && replayFrame ? `${replayFrame.label}` : actionInstruction}</p>}
        {replaying && replayFrame && replayFrame.options.length > 0 && <div className={`choices replay-choices ${replayFrame.options.some((option) => option.kind === 'chance') ? 'replay-chance-choices' : ''}`}>{replayFrame.options.map((option) => <button type="button" key={option.id} disabled className={option.chosen ? 'chosen' : ''}><span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span><ChevronRight size={18} /></button>)}</div>}
        {phase === 'playing' && !replaying && node.type === 'batting' && (node.mode === 'direct' || adminMode) && <div className={`choices batting-choices ${adminMode && node.mode === 'random' ? 'admin-batting-choices' : ''}`} key={`choices:${displayedState.nodeId}:${announcementRenderKey}`}>{BATTING_EVENTS.filter((event) => node.eventIds.includes(event.kind) && (node.mode === 'random' ? adminMode : ['single', 'double', 'triple', 'homeRun', 'walk', 'hitByPitch', 'strikeout', 'groundOut', 'infieldFly', 'flyOut'].includes(event.kind))).map((event) => <button type="button" onClick={() => chooseBatting(event.kind)} key={event.kind}><span><strong>{event.label}</strong><small>{event.description}</small></span><ChevronRight size={18} /></button>)}</div>}
        {phase === 'playing' && !replaying && node.type === 'choice' && <div className={`choices runner-choices ${availableChoices.length === 1 ? 'single-choice' : ''}`} key={`choices:${displayedState.nodeId}:${announcementRenderKey}`}>{availableChoices.map((choice) => <button type="button" onClick={() => chooseOption(choice.id)} key={choice.id}><span><strong>{choice.label}</strong>{choice.description && <small>{choice.description}</small>}</span><ChevronRight size={18} /></button>)}</div>}
        {phase === 'playing' && !replaying && adminMode && node.type === 'chance' && <div className="admin-console" key={`choices:${displayedState.nodeId}:${announcementRenderKey}`}><span>관리자 콘솔 · 확률 결과 선택</span><div className={`choices runner-choices ${node.outcomes.length === 1 ? 'single-choice' : ''}`}>{node.outcomes.map((outcome) => <button type="button" onClick={() => chooseChanceOutcome(outcome.id)} key={outcome.id}><span><strong>{outcome.label ?? `${node.title} ${outcome.id}`}</strong><small>확률 {Math.round(outcome.weight * 100)}%</small></span><ChevronRight size={18} /></button>)}</div></div>}
        {phase === 'between' && <div className="play-result"><p className="eyebrow">PLAY COMPLETE</p><h3>{records.at(-1)?.result}</h3><p>{plateAppearance === 3 ? '모든 타석이 끝났습니다.' : '다음 타석은 새로운 상황에서 시작합니다.'}</p><button className="primary-button" type="button" onClick={continueGame}>{plateAppearance === 3 ? '결과 보기' : '다음 타석'} <ChevronRight size={18} /></button></div>}
      </section>
    </div>
    {replay && <div className="replay-controls" role="group" aria-label="아나운스 재생 컨트롤">
      <span className="replay-step-label"><b>{replay.index + 1}/{replay.frames.length}</b>{replayFrame?.label}</span>
      <div className="replay-buttons">
        <button type="button" onClick={() => setReplay((current) => current && { ...current, playing: false, index: Math.max(0, current.index - 1) })} disabled={replay.index === 0}><SkipBack size={16} /> 이전 단계</button>
        <button className={replay.playing ? 'replay-auto-on' : ''} type="button" onClick={() => setReplay((current) => current && { ...current, playing: !current.playing })}>{replay.playing ? <Pause size={16} /> : <Play size={16} />} {replay.playing ? '자동 재생 중' : '자동 재생'}</button>
        <button type="button" onClick={() => setReplay((current) => current && { ...current, playing: false, index: Math.min(current.frames.length - 1, current.index + 1) })} disabled={replayAtEnd}>다음 단계 <SkipForward size={16} /></button>
        <button type="button" onClick={() => setReplay(null)}>재생 종료</button>
      </div>
    </div>}
    <footer className="progress-strip">{[1, 2, 3].map((item) => <div className={item < plateAppearance || phase === 'between' && item === plateAppearance ? 'complete' : item === plateAppearance ? 'active' : ''} key={item}><span>0{item}</span><i /><p>{records[item - 1]?.result ?? (item === plateAppearance ? '진행 중' : '대기')}</p></div>)}</footer>
  </main>
}

export default App
