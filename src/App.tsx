import { Bug, CheckCircle2, ChevronRight, Pause, Play, RotateCcw, SkipBack, SkipForward, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createAnnouncementAuditCases, findMatchingCaseId, getAnnouncementMessages, replayAnnouncementCase, type AnnouncementAuditCase, type AnnouncementReplayFrame } from './game/announcementAudit'
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
import { formatScenarioText } from './game/scenarioText'
import type { AdvanceConcept, ScenarioState, ScenarioView } from './game/scenario'
import { resolveAdvanceConcept } from './game/advanceConcept'
import {
  buildAnnouncementImageTrail,
  resolveAnnouncementDetailSceneId,
  resolveAnnouncementDetailView,
  resolveAnnouncementImageBase,
  resolveSceneImage,
  resolveSceneImageFilename,
  resolveViewImage,
  resolveViewImageFilename,
  shouldShareDetailSceneForTitle,
} from './game/sceneMedia'
import './App.css'

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
    `시작 상황: ${describeSituation(item.start)}`,
    `결과 상태: ${item.situation}`,
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

function MediaStage({ situation, plateAppearance, playerBase, imageUrl, viewLabel, isSurpriseEvent, isPlateEntry, videoUrl, missingImageName, arrivalEffect, preserveImage, backgroundDimmingDelay, backgroundDimmingKey }: { situation: Situation; plateAppearance: number; playerBase: number | null; imageUrl?: string; viewLabel?: string | null; isSurpriseEvent?: boolean; isPlateEntry?: boolean; videoUrl?: string; missingImageName?: string | null; arrivalEffect?: AdvanceConcept; preserveImage?: boolean; backgroundDimmingDelay?: number; backgroundDimmingKey?: string }) {
  const [backgroundDimmedToken, setBackgroundDimmedToken] = useState('')
  const backgroundDimmingToken = `${backgroundDimmingKey ?? ''}:${backgroundDimmingDelay ?? ''}`

  useEffect(() => {
    if (backgroundDimmingDelay === undefined) return
    const timer = window.setTimeout(() => setBackgroundDimmedToken(backgroundDimmingToken), backgroundDimmingDelay)
    return () => window.clearTimeout(timer)
  }, [backgroundDimmingDelay, backgroundDimmingToken])

  return <section className={`media-stage ${backgroundDimmedToken === backgroundDimmingToken && backgroundDimmingDelay !== undefined ? 'background-dimmed' : ''}`} aria-live="polite">
    {videoUrl && <video src={videoUrl} autoPlay muted playsInline controls />}
    {!videoUrl && imageUrl && <img src={imageUrl} alt="" className={preserveImage ? 'preserve-image' : arrivalEffect ? `arrival-${arrivalEffect}` : ''} key={imageUrl} />}
    {!videoUrl && missingImageName && <div className="media-image-fallback" aria-live="polite"><span>{missingImageName}</span></div>}
    {viewLabel && <div className={`media-view-label ${isSurpriseEvent ? 'surprise-chip' : ''}`}>{viewLabel}</div>}
    <div className={`broadcast-bug ${isPlateEntry ? 'plate-entry-flash' : ''}`}>
      <div className="broadcast-plate"><span>공격</span><strong>{plateAppearance}<small>/3</small></strong></div>
      <div className="broadcast-runners"><BaseDiamond bases={situation.bases} playerBase={playerBase} /></div>
      <div className="broadcast-outs"><span>OUT</span><div>{[0, 1, 2].map((out) => <i className={out < situation.outs ? 'on' : ''} key={out} />)}</div></div>
    </div>
  </section>
}

function TapContinueButton({ stepKey, onClick }: { stepKey: string; onClick: () => void }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [stepKey])

  if (!isReady) return null
  return <button type="button" className="tap-continue-button" onClick={(event) => { event.stopPropagation(); onClick() }} aria-label="다음 장면 보기">탭하여 계속 <ChevronRight size={15} aria-hidden="true" /></button>
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
          <div className="audit-card-meta"><span>시작: {describeSituation(item.start)}</span><span>결과: {item.situation}</span><span>{item.viewLabel}</span>{item.isSurprise && <b>돌발 이벤트</b>}{status === 'needsReview' && <b className="review-chip">검토 필요</b>}{status === 'ok' && <b className="ok-chip">문제 없음</b>}</div>
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
  const [situationPlayerBase, setSituationPlayerBase] = useState<number | null>(null)
  const [plateStartSituation, setPlateStartSituation] = useState(situation)
  const [scenario, setScenario] = useState<ScenarioState>(() => startScenario(OFFENSE_CORE_PACK, createScenarioContext(situation), { manualChance: adminMode }))
  const [stats, setStats] = useState<Stats>({ runs: 0, hits: 0, outs: 0 })
  const [records, setRecords] = useState<RecordEntry[]>([])

  const replayFrame = replay ? replay.frames[replay.index] : null
  const displayedState = replayFrame?.state ?? scenario
  const sceneNode = OFFENSE_CORE_PACK.nodes[displayedState.nodeId]
  const sceneNodeViewBase = sceneNode.view === 'runner:first' ? 1 : sceneNode.view === 'runner:second' ? 2 : sceneNode.view === 'runner:third' ? 3 : null
  const sceneCurrentViewBase = sceneNode.tags?.includes('player-position-view') && sceneNodeViewBase === 1 ? displayedState.context.playerBase : sceneNodeViewBase
  const sceneImageView: ScenarioView = sceneCurrentViewBase ? `runner:${sceneCurrentViewBase === 1 ? 'first' : sceneCurrentViewBase === 2 ? 'second' : 'third'}` : sceneNode.view
  const isSurpriseScene = sceneNode.tags?.includes('surprise-event') ?? false
  const sceneAnnouncements = getAnnouncementMessages(displayedState)
  const sceneDetailView = resolveAnnouncementDetailView(sceneImageView, displayedState.context.playerBase)
  const sceneImageTrail = buildAnnouncementImageTrail(sceneAnnouncements, sceneImageView, displayedState.context.playerBase)
  const sceneAnnouncementCount = sceneAnnouncements.length
  // 일반 흐름: 각 장면은 이미지 + 누적 아나운스 묶음으로 표시하고, 탭으로 다음 장면으로 진행한다.
  // 마지막 발표가 끝나면 일정 시간 뒤 자동으로 최종 시점 이미지와 선택지로 전환한다.
  const sceneAnnouncementStages = sceneAnnouncements.flatMap((announcement, index) => {
    const announcementStages = shouldShareDetailSceneForTitle(announcement)
      ? [{ announcementIndex: index, showDetail: true }]
      : [{ announcementIndex: index, showDetail: false }, { announcementIndex: index, showDetail: true }]
    const shouldAddChoiceViewStage = index === sceneAnnouncements.length - 1 && sceneNode.type === 'choice' && !isSurpriseScene
    return shouldAddChoiceViewStage ? [...announcementStages, { announcementIndex: index, showDetail: true, showChoiceView: true }] : announcementStages
  })
  const sceneTotalTapSteps = sceneAnnouncementCount === 0 ? 1 : sceneAnnouncementStages.length
  const sceneSequenceKey = `${displayedState.context.announcementHistory.length}:${displayedState.context.announcement?.title ?? ''}:${displayedState.context.announcement?.detail ?? ''}:${sceneImageView}:${displayedState.context.playerBase ?? 'none'}`
  const [tapProgress, setTapProgress] = useState({ key: '', step: 0 })
  const sceneStep = tapProgress.key === sceneSequenceKey ? Math.min(tapProgress.step, sceneTotalTapSteps - 1) : 0
  const sceneIsFinalStep = replay !== null || sceneStep >= sceneTotalTapSteps - 1
  const sceneCurrentStage = sceneAnnouncementStages[sceneStep]
  const sceneEventIndex = sceneAnnouncementCount === 0 ? -1 : sceneCurrentStage.announcementIndex
  const sceneIsDetailStep = replay !== null || sceneAnnouncementCount === 0 || sceneCurrentStage.showDetail
  const sceneIsChoiceViewStep = sceneCurrentStage && 'showChoiceView' in sceneCurrentStage && sceneCurrentStage.showChoiceView
  const sceneRevealedCount = sceneAnnouncementCount === 0 ? 0 : sceneIsFinalStep ? sceneAnnouncementCount : sceneEventIndex + 1
  const currentAnnouncement = sceneAnnouncements[sceneEventIndex]
  const isSurpriseAnnouncement = currentAnnouncement?.category === 'surprise'
  const sceneDetailScene = resolveAnnouncementDetailSceneId(currentAnnouncement)
  const sceneDetailAnnouncement = sceneDetailScene
    ? { title: currentAnnouncement!.title, scene: sceneDetailScene }
    : undefined
  const shouldUseChoiceViewImage = sceneIsChoiceViewStep
  const sceneDetailImageUrl = shouldUseChoiceViewImage
    ? resolveViewImage(sceneDetailView)
    : sceneDetailAnnouncement
    ? resolveSceneImage(sceneDetailAnnouncement, resolveAnnouncementImageBase(currentAnnouncement, displayedState.context.playerBase))
    : resolveViewImage(sceneDetailView)
  const shareDetailSceneForTitle = shouldShareDetailSceneForTitle(currentAnnouncement) && Boolean(sceneDetailAnnouncement && sceneDetailImageUrl)
  const sceneMissingImageName = sceneIsDetailStep || isSurpriseAnnouncement || shareDetailSceneForTitle
    ? (sceneDetailImageUrl ? undefined : shouldUseChoiceViewImage
      ? resolveViewImageFilename(sceneDetailView)
      : sceneDetailAnnouncement
      ? resolveSceneImageFilename(sceneDetailAnnouncement, resolveAnnouncementImageBase(currentAnnouncement, displayedState.context.playerBase))
      : resolveViewImageFilename(sceneDetailView))
    : (() => {
      if (!currentAnnouncement) return undefined
      const imageBase = resolveAnnouncementImageBase(currentAnnouncement, displayedState.context.playerBase)
      const expectedImage = resolveSceneImage(currentAnnouncement, imageBase)
      return expectedImage ? undefined : resolveSceneImageFilename(currentAnnouncement, imageBase)
    })()
  const sceneImageUrl = sceneMissingImageName ? undefined : (sceneIsDetailStep || isSurpriseAnnouncement || shareDetailSceneForTitle ? sceneDetailImageUrl : sceneImageTrail[sceneEventIndex])
  const advanceScene = () => {
    if (sceneIsFinalStep) return
    setTapProgress({ key: sceneSequenceKey, step: sceneStep + 1 })
  }

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
    setSituationPlayerBase(null)
    setPlateStartSituation(nextSituation)
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
      outs: current.outs + Math.max(0, state.context.outs - plateStartSituation.outs),
    }))
    setRecords((current) => [...current, {
      number: plateAppearance,
      situation: describeSituation(plateStartSituation),
      decision: state.context.selectedLabel ?? '타격',
      result,
      runs: state.context.runs,
    }])
    setScenario(state)
    setPhase('between')
  }

  const acceptState = (next: ScenarioState) => {
    const terminal = OFFENSE_CORE_PACK.nodes[next.nodeId].type === 'terminal'
    setSituation({ outs: scenario.context.outs, bases: scenario.context.bases as Base[] })
    setSituationPlayerBase(scenario.context.playerBase)
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

  const completeReplayAudit = (status: AnnouncementAuditStatus) => {
    if (!highlightedAuditCaseId) return
    setAnnouncementCaseStatus(highlightedAuditCaseId, status)
    setReplay(null)
    setAnnouncementAuditTab('pending')
    setAppMode('announcementCheck')
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

  const node = sceneNode
  const replaying = replay !== null
  const replayAtEnd = replay ? replay.index === replay.frames.length - 1 : false
  const isPlateEntry = phase === 'playing' && node.type === 'batting' && !replaying
  const shouldShowResolvedSituation = replaying || sceneIsFinalStep && sceneIsDetailStep
  const displayedSituation = shouldShowResolvedSituation
    ? { outs: displayedState.context.outs, bases: displayedState.context.bases as Base[] }
    : situation
  const displayedPlayerBase = shouldShowResolvedSituation ? displayedState.context.playerBase : situationPlayerBase
  const currentViewBase = sceneCurrentViewBase
  const viewLabel = node.view.startsWith('runner:') && currentViewBase
    ? `${currentViewBase}루 주자 시점`
    : node.view === 'batter' ? '타석 시점' : null
  const announcementMessages = sceneAnnouncements
  const overlayMessages = replaying ? announcementMessages : announcementMessages.slice(0, sceneRevealedCount)
  const surpriseOverlayAnnouncement = overlayMessages.findLast((message) => message.category === 'surprise')
  const isSurpriseEvent = isSurpriseScene && surpriseOverlayAnnouncement !== undefined
  const highlightedViewLabel = replaying && replayFrame
    ? `재생 ${replay.index + 1}/${replay.frames.length} · ${viewLabel ?? '결과'}`
    : isSurpriseEvent && viewLabel ? `${viewLabel} : 돌발 이벤트!` : viewLabel
  const availableChoices = getAvailableScenarioChoices(OFFENSE_CORE_PACK, scenario)
  const tapHintTargetKey = `${sceneSequenceKey}:${sceneStep}`
  const shouldShowTapHint = !sceneIsFinalStep && !!overlayMessages.at(-1)?.detail
  const choiceDescription = node.type === 'choice' && isSurpriseEvent && currentViewBase
    ? `${currentViewBase}루 주자: 돌발 상황 대처`
    : node.type === 'choice' && node.tags?.includes('player-position-view') && currentViewBase && node.description
    ? node.description.startsWith(`${currentViewBase}루 주자:`) ? formatScenarioText(node.description, scenario.context.playerBase) : `${currentViewBase}루 주자: ${formatScenarioText(node.description, scenario.context.playerBase)}`
    : node.type === 'choice' ? formatScenarioText(node.description, scenario.context.playerBase) : undefined
  const surpriseOverlayImageUrl = surpriseOverlayAnnouncement
    ? resolveSceneImage(surpriseOverlayAnnouncement, resolveAnnouncementImageBase(surpriseOverlayAnnouncement, displayedState.context.playerBase))
    : undefined
  const surpriseOverlayImageName = surpriseOverlayAnnouncement
    ? resolveSceneImageFilename(surpriseOverlayAnnouncement, resolveAnnouncementImageBase(surpriseOverlayAnnouncement, displayedState.context.playerBase))
    : undefined
  const announcementRenderKey = `${displayedState.context.announcementHistory.length}:${displayedState.context.announcement?.title ?? ''}:${displayedState.context.announcement?.detail ?? ''}`
  const canAct = phase === 'playing' && (sceneIsFinalStep || adminMode && sceneNode.type === 'chance')
  const isNormalChoiceOverlayVisible = canAct && !replaying && node.type === 'choice' && !isSurpriseEvent && availableChoices.length > 0
  const playResultVisible = phase === 'between' && sceneIsFinalStep
  const backgroundDimmingDelay = isNormalChoiceOverlayVisible ? overlayMessages.length > 1 ? 1410 : overlayMessages.length > 0 ? 770 : 520 : playResultVisible ? 0 : undefined
  const arrivalEffect = sceneIsFinalStep ? resolveAdvanceConcept(currentAnnouncement ?? displayedState.context.announcement) : undefined
  const actionInstruction = node.type === 'batting'
    ? adminMode && node.mode === 'random' ? '관리자: 후속 타자 결과를 지정하세요.' : '타격 결과를 선택해주세요.'
    : node.type === 'choice'
      ? choiceDescription ?? '주루 방침을 선택해주세요.'
      : node.type === 'chance' && adminMode
        ? '관리자: 확률 결과를 지정하세요.'
      : ''
  const sceneTapProps = sceneIsFinalStep ? {} : {
    onClick: advanceScene,
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': '탭하여 다음 장면 보기',
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      advanceScene()
    },
  }

  return <main className="app-shell">
    <header className="brand-bar"><button className="brand-title audit-entry-enabled" type="button" onClick={openAuditFromGame} aria-label="아나운스 텍스트 체크 모드 열기"><b className="brand-mark">EPS</b><span>BASEBALL SIM</span></button><div className="header-controls">{replay && <button className="secondary-button audit-return-button" type="button" onClick={() => setAppMode('announcementCheck')}>체크로 돌아가기</button>}{findMatchingCaseId(scenario) && <button className="secondary-button" type="button" onClick={openAuditFromGame}><Bug size={14} /> 이 텍스트 체크하기</button>}<label className="admin-toggle"><SlidersHorizontal size={14} /><span>관리자</span><input type="checkbox" checked={adminMode} onChange={(event) => toggleAdminMode(event.target.checked)} aria-label="관리자 콘솔" /><i /></label><button className="icon-button" type="button" onClick={resetGame} title="새 경기" aria-label="새 경기"><RotateCcw size={18} /></button></div></header>
    <div className={`game-grid ${sceneIsFinalStep ? '' : 'game-grid-tappable'} ${isSurpriseEvent ? 'surprise-overlay-visible' : ''}`} {...sceneTapProps}>
      <MediaStage situation={displayedSituation} plateAppearance={plateAppearance} playerBase={displayedPlayerBase} imageUrl={sceneImageUrl} viewLabel={highlightedViewLabel} isSurpriseEvent={isSurpriseEvent} isPlateEntry={isPlateEntry} missingImageName={sceneMissingImageName} arrivalEffect={arrivalEffect} preserveImage={shareDetailSceneForTitle} backgroundDimmingDelay={backgroundDimmingDelay} backgroundDimmingKey={`${displayedState.nodeId}:${announcementRenderKey}:${playResultVisible}`} />
      <section className={`decision-panel ${isPlateEntry ? 'plate-entry-panel' : ''} ${isSurpriseEvent ? 'surprise-event-panel' : ''} ${overlayMessages.length > 0 ? 'has-announcement' : ''} ${overlayMessages.length > 1 ? 'has-compound-announcement' : ''}`}>
        {overlayMessages.length > 0 && <aside className={`result-notice ${overlayMessages.at(-1)?.tone ?? 'neutral'}`} aria-live="polite" key={replaying ? `replay:${replayFrame?.stepIndex ?? 'live'}` : sceneSequenceKey}>
          <span>{replaying ? '아나운스 재생' : '방금 일어난 일'}</span>
          <div className="notice-stack">
            <div className="message-flow">
              {overlayMessages.map((message, index) => {
                const showMessageDetail = replaying || index < sceneEventIndex || (index === sceneEventIndex && sceneIsDetailStep)
                return <div className="message-flow-entry" key={`${message.title}:${message.detail}:${index}`}>
                  {index > 0 && <span className="message-flow-connector" style={{ animationDelay: `${0.31 + (index - 1) * 0.43}s` }}>그리고</span>}
                  <div className={`message-flow-message ${message.category === 'surprise' ? 'surprise-message' : 'normal-message'} ${message.tone ?? 'neutral'}`} style={{ animationDelay: `${0.1 + index * 0.43}s` }}>
                    <strong>{message.title}</strong>
                    {showMessageDetail && <div className="message-detail-row"><p>{message.detail}</p></div>}
                  </div>
                </div>
              })}
            </div>
          </div>
        </aside>}
        {isSurpriseEvent && surpriseOverlayAnnouncement && <div className={`surprise-event-image ${surpriseOverlayImageUrl ? '' : 'missing'}`} aria-label={`${surpriseOverlayAnnouncement.title} 연출 이미지`}>
          {surpriseOverlayImageUrl ? <img src={surpriseOverlayImageUrl} alt="" /> : <span>{surpriseOverlayImageName ?? '돌발 이벤트 이미지 파일 필요'}</span>}
        </div>}
        {shouldShowTapHint && <TapContinueButton key={tapHintTargetKey} stepKey={tapHintTargetKey} onClick={advanceScene} />}
        {canAct && actionInstruction && <p className={`action-instruction ${node.type === 'choice' ? 'choice-instruction' : ''}`} key={`${displayedState.nodeId}:${actionInstruction}:${announcementRenderKey}`}>{actionInstruction}</p>}
        {replaying && replayFrame && replayFrame.options.length > 0 && <div className={`choices replay-choices ${replayFrame.options.some((option) => option.kind === 'chance') ? 'replay-chance-choices' : ''}`}>{replayFrame.options.map((option) => <button type="button" key={option.id} disabled className={option.chosen ? 'chosen' : ''}><span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span><ChevronRight size={18} /></button>)}</div>}
        {canAct && !replaying && node.type === 'batting' && (node.mode === 'direct' || adminMode) && <div className={`choices batting-choices ${adminMode && node.mode === 'random' ? 'admin-batting-choices' : ''}`} key={`choices:${displayedState.nodeId}:${announcementRenderKey}`}>{BATTING_EVENTS.filter((event) => node.eventIds.includes(event.kind) && (node.mode === 'random' ? adminMode : ['single', 'double', 'triple', 'homeRun', 'walk', 'hitByPitch', 'strikeout', 'groundOut', 'infieldFly', 'flyOut'].includes(event.kind))).map((event) => <button type="button" onClick={() => chooseBatting(event.kind)} key={event.kind}><span><strong>{event.label}</strong><small>{event.description}</small></span><ChevronRight size={18} /></button>)}</div>}
        {canAct && !replaying && node.type === 'choice' && <div className={`choices runner-choices ${availableChoices.length === 1 ? 'single-choice' : ''}`} key={`choices:${displayedState.nodeId}:${announcementRenderKey}`}>{availableChoices.map((choice) => <button type="button" onClick={() => chooseOption(choice.id)} key={choice.id}><span><strong>{choice.label}</strong>{choice.description && <small>{choice.description}</small>}</span><ChevronRight size={18} /></button>)}</div>}
        {canAct && !replaying && adminMode && node.type === 'chance' && <div className="admin-console" key={`choices:${displayedState.nodeId}:${announcementRenderKey}`} onClick={(event) => event.stopPropagation()}><span>관리자 콘솔 · 확률 결과 선택</span><div className={`choices runner-choices ${node.outcomes.length === 1 ? 'single-choice' : ''}`}>{node.outcomes.map((outcome) => <button type="button" onClick={() => chooseChanceOutcome(outcome.id)} key={outcome.id}><span><strong>{outcome.label ?? `${node.title} ${outcome.id}`}</strong><small>확률 {Math.round(outcome.weight * 100)}%</small></span><ChevronRight size={18} /></button>)}</div></div>}
        {playResultVisible && <div className="play-result"><p className="eyebrow">PLAY COMPLETE</p><h3>{records.at(-1)?.result}</h3><p>{plateAppearance === 3 ? '모든 타석이 끝났습니다.' : '다음 타석은 새로운 상황에서 시작합니다.'}</p><button className="primary-button" type="button" onClick={continueGame}>{plateAppearance === 3 ? '결과 보기' : '다음 타석'} <ChevronRight size={18} /></button></div>}
      </section>
    </div>
    {replay && <div className="replay-controls" role="group" aria-label="아나운스 재생 컨트롤">
      <span className="replay-step-label"><b>{replay.index + 1}/{replay.frames.length}</b>{replayFrame?.label}</span>
      <div className="replay-buttons">
        <button type="button" onClick={() => setReplay((current) => current && { ...current, playing: false, index: Math.max(0, current.index - 1) })} disabled={replay.index === 0}><SkipBack size={16} /> 이전 단계</button>
        <button className={replay.playing ? 'replay-auto-on' : ''} type="button" onClick={() => setReplay((current) => current && { ...current, playing: !current.playing })}>{replay.playing ? <Pause size={16} /> : <Play size={16} />} {replay.playing ? '자동 재생 중' : '자동 재생'}</button>
        <button type="button" onClick={() => setReplay((current) => current && { ...current, playing: false, index: Math.min(current.frames.length - 1, current.index + 1) })} disabled={replayAtEnd}>다음 단계 <SkipForward size={16} /></button>
        {replayAtEnd ? <><button className="replay-review-button" type="button" onClick={() => completeReplayAudit('needsReview')}>검토 필요</button><button className="replay-ok-button" type="button" onClick={() => completeReplayAudit('ok')}><CheckCircle2 size={16} /> 문제 없음</button></> : <button type="button" onClick={() => setReplay(null)}>재생 종료</button>}
      </div>
    </div>}
    <footer className="progress-strip">{[1, 2, 3].map((item) => <div className={item < plateAppearance || phase === 'between' && item === plateAppearance ? 'complete' : item === plateAppearance ? 'active' : ''} key={item}><span>0{item}</span><i /><p>{records[item - 1]?.result ?? (item === plateAppearance ? '진행 중' : '대기')}</p></div>)}</footer>
  </main>
}

export default App
