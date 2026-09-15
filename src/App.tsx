import { CheckCircle2, ChevronLeft, ChevronRight, Download, Pause, Play, RotateCcw, SkipBack, SkipForward, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import logoImage from './assets/eg_logo-header.png'
import { getAnnouncementMessages, getReplayOptions, type AnnouncementReplayFrame } from './game/announcementAudit'
import { BATTING_CATEGORIES, BATTING_EVENTS, PROBABILISTIC_BATTING_CHOICES, resolveProbabilisticBattingChoice, type BattingCategory, type BattingEventId, type ProbabilisticBattingChoice } from './game/battingEvents'
import { PLAY_RESULT_CODES, PLAY_RESULT_ITEMS, matchAnnouncementToResultCode, resolvePlayResultCode } from './game/playResultCodes'
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
import type { ScenarioState, ScenarioView } from './game/scenario'
import { resolveAdvanceConcept } from './game/advanceConcept'
import {
  buildAnnouncementImageTrail,
  resolveAnnouncementDetailSceneId,
  resolveAnnouncementDetailImage,
  resolveAnnouncementDetailImageFilename,
  resolveAnnouncementDetailView,
  resolveAnnouncementImageBase,
  resolveSceneId,
  resolveSceneImage,
  resolveSceneImageFilename,
  resolveSceneTransitionState,
  getSceneImageUrls,
  resolveViewImage,
  resolveViewImageFilename,
  shouldShareDetailSceneForTitle,
  shouldUseViewImageForAnnouncementStep,
} from './game/sceneMedia'
import './App.css'

type Phase = 'playing' | 'between' | 'finished'
type AppMode = 'game' | 'codeMapping'
type BattingInputMode = 'direct' | 'probabilistic'
type RecordEntry = {
  number: number
  situation: string
  decision: string
  result: string
  items: string[]
  frames: AnnouncementReplayFrame[]
}
type ImagePreloadState = 'idle' | 'loading' | 'complete'
const ESTIMATED_SCENE_IMAGE_BYTES = 56_756_975

const formatDataSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const formatAnnouncementScore = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return ''
  if (value === 0) return '0.0'
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)
}

const getResourceTransferSize = (url: string, previousEntryCount: number) => {
  const entries = performance.getEntriesByName(url, 'resource') as PerformanceResourceTiming[]
  const entry = entries[entries.length - 1]
  return entries.length > previousEntryCount ? entry?.transferSize ?? 0 : 0
}

const preloadSceneImage = (url: string, previousEntryCount: number) => new Promise<number>((resolve) => {
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    void image.decode().catch(() => undefined).finally(() => resolve(getResourceTransferSize(url, previousEntryCount)))
  }
  image.onerror = () => resolve(getResourceTransferSize(url, previousEntryCount))
  image.src = url
})

const BATTING_INPUT_MODE_STORAGE_KEY = 'eps:batting-input-mode:v1'

const loadBattingInputMode = (): BattingInputMode => {
  try {
    const value = localStorage.getItem(BATTING_INPUT_MODE_STORAGE_KEY)
    return value === 'direct' || value === 'probabilistic' ? value : 'probabilistic'
  } catch {
    return 'probabilistic'
  }
}

const saveBattingInputMode = (mode: BattingInputMode) => {
  try {
    localStorage.setItem(BATTING_INPUT_MODE_STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

function BaseDiamond({ bases, playerBase }: { bases: Base[]; playerBase?: number | null }) {
  return <div className="diamond" aria-label={describeBases(bases)}>
    <span className={`base base-second ${bases.includes(2) ? 'occupied' : ''} ${playerBase === 2 ? 'player-base' : ''}`} />
    <span className={`base base-third ${bases.includes(3) ? 'occupied' : ''} ${playerBase === 3 ? 'player-base' : ''}`} />
    <span className={`base base-first ${bases.includes(1) ? 'occupied' : ''} ${playerBase === 1 ? 'player-base' : ''}`} />
  </div>
}

function MediaStage({ situation, plateAppearance, playerBase, imageUrl, viewLabel, isSurpriseEvent, isPlateEntry, videoUrl, missingImageName, transition, backgroundDimmingDelay, backgroundDimmingKey, hideBroadcastBug }: { situation: Situation; plateAppearance: number; playerBase: number | null; imageUrl?: string; viewLabel?: string | null; isSurpriseEvent?: boolean; isPlateEntry?: boolean; videoUrl?: string; missingImageName?: string | null; transition?: { preset: string; triggerKey: string; enabled: boolean }; backgroundDimmingDelay?: number; backgroundDimmingKey?: string; hideBroadcastBug?: boolean }) {
  const [backgroundDimmedToken, setBackgroundDimmedToken] = useState('')
  const [imageLayers, setImageLayers] = useState<{ current?: string; previous?: string }>({ current: imageUrl })
  const backgroundDimmingToken = `${backgroundDimmingKey ?? ''}:${backgroundDimmingDelay ?? ''}`

  useEffect(() => {
    setImageLayers((layers) => {
      if (layers.current === imageUrl && (!layers.previous || transition?.enabled)) return layers
      return transition?.enabled ? { current: imageUrl, previous: layers.current } : { current: imageUrl }
    })
  }, [imageUrl, transition?.enabled])

  useEffect(() => {
    if (!imageLayers.previous) return
    const timer = window.setTimeout(() => setImageLayers((layers) => ({ current: layers.current })), 720)
    return () => window.clearTimeout(timer)
  }, [imageLayers.previous])

  useEffect(() => {
    if (backgroundDimmingDelay === undefined) return
    const timer = window.setTimeout(() => setBackgroundDimmedToken(backgroundDimmingToken), backgroundDimmingDelay)
    return () => window.clearTimeout(timer)
  }, [backgroundDimmingDelay, backgroundDimmingToken])

  return <section className={`media-stage ${backgroundDimmedToken === backgroundDimmingToken && backgroundDimmingDelay !== undefined ? 'background-dimmed' : ''}`} aria-live="polite">
    {videoUrl && <video src={videoUrl} autoPlay muted playsInline controls />}
    {!videoUrl && imageLayers.previous && <img src={imageLayers.previous} alt="" className="media-image-layer media-image-layer-previous" aria-hidden="true" />}
    {!videoUrl && imageLayers.current && <img src={imageLayers.current} alt="" className={`media-image-layer media-image-layer-current ${transition?.enabled ? `media-transition-${transition.preset}` : 'preserve-image'}`} key={`${imageLayers.current}:${transition?.triggerKey ?? ''}`} />}
    {!videoUrl && missingImageName && <div className="media-image-fallback" aria-live="polite"><span>{missingImageName}</span></div>}
    {viewLabel && <div className={`media-view-label ${isSurpriseEvent ? 'surprise-chip' : ''}`}>{viewLabel}</div>}
    <div className={`broadcast-bug ${isPlateEntry ? 'plate-entry-flash' : ''} ${hideBroadcastBug ? 'completion-hidden' : ''}`}>
      <div className="broadcast-plate"><span>공격</span><strong>{plateAppearance}<small>/3</small></strong></div>
      <div className="broadcast-runners"><BaseDiamond bases={situation.bases} playerBase={playerBase} /></div>
      <div className="broadcast-outs"><span>OUT</span><div>{[0, 1, 2].map((out) => <i className={out < situation.outs ? 'on' : ''} key={out} />)}</div></div>
    </div>
  </section>
}

function CodeMappingMode({ onBack }: { onBack: () => void }) {
  return <main className="app-shell audit-page">
    <header className="brand-bar audit-header"><button className="brand-title" type="button" onClick={onBack}><img className="brand-logo" src={logoImage} alt="" /><span>EPS Simulator</span></button><div className="header-controls"><button className="icon-button" type="button" onClick={onBack} title="게임으로 돌아가기" aria-label="게임으로 돌아가기"><RotateCcw size={18} /></button></div></header>
    <section className="audit-summary">
      <p className="eyebrow">CODE MAPPING TEST</p>
      <h1>타석 결산 항목-코드-점수 매핑</h1>
      <p>이번 타석 결산에 표시되는 각 항목에 어떤 코드와 점수가 연결되어 있는지 확인합니다. 값은 src/game/playResultCodes.ts 에서 관리합니다.</p>
    </section>
    <section className="audit-list" aria-label="항목-코드-점수 매핑 목록">
      <div className="play-result-record" aria-label="항목 코드 점수 매핑 표">
        <div className="play-result-columns"><span>항목</span><span>코드</span><span>점수</span></div>
        {PLAY_RESULT_CODES.map((entry) => <div className="play-result-entry" key={entry.item}><strong>{entry.item}</strong><span>{entry.code || '미정'}</span><span>{entry.score ?? '미정'}</span></div>)}
      </div>
    </section>
  </main>
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

function App() {
  const [appMode, setAppMode] = useState<AppMode>('game')
  const [adminMode, setAdminMode] = useState(false)
  const [battingInputMode, setBattingInputModeState] = useState<BattingInputMode>(() => loadBattingInputMode())
  const [selectedBattingCategory, setSelectedBattingCategory] = useState<BattingCategory | null>(null)
  const [replay, setReplay] = useState<{ frames: AnnouncementReplayFrame[]; index: number; playing: boolean } | null>(null)
  const [replayReturnPhase, setReplayReturnPhase] = useState<Phase | null>(null)
  const [plateAppearance, setPlateAppearance] = useState(1)
  const [phase, setPhase] = useState<Phase>('playing')
  const [situation, setSituation] = useState<Situation>(() => createRandomSituation())
  const [situationPlayerBase, setSituationPlayerBase] = useState<number | null>(null)
  const [plateStartSituation, setPlateStartSituation] = useState(situation)
  const [scenario, setScenario] = useState<ScenarioState>(() => startScenario(OFFENSE_CORE_PACK, createScenarioContext(situation), { manualChance: adminMode }))
  const [plateReplayFrames, setPlateReplayFrames] = useState<AnnouncementReplayFrame[]>(() => {
    const initial = startScenario(OFFENSE_CORE_PACK, createScenarioContext(situation), { manualChance: adminMode })
    return [{ stepIndex: 0, label: `시작 · ${describeSituation(situation)}`, state: initial, options: getReplayOptions(initial) }]
  })
  const [records, setRecords] = useState<RecordEntry[]>([])
  const [playResultReady, setPlayResultReady] = useState(false)
  const [imagePreloadState, setImagePreloadState] = useState<ImagePreloadState>('idle')
  const [imagePreloadProgress, setImagePreloadProgress] = useState({ loaded: 0, total: 0, bytes: 0 })
  const [isImagePreloadDialogOpen, setIsImagePreloadDialogOpen] = useState(false)

  const preloadAllSceneImages = async () => {
    if (imagePreloadState === 'loading') return
    const urls = getSceneImageUrls()
    const previousEntryCounts = new Map(urls.map((url) => [url, performance.getEntriesByName(url, 'resource').length]))
    setImagePreloadState('loading')
    setImagePreloadProgress({ loaded: 0, total: urls.length, bytes: 0 })

    let nextIndex = 0
    let loaded = 0
    let bytes = 0
    const worker = async () => {
      while (nextIndex < urls.length) {
        const url = urls[nextIndex]
        nextIndex += 1
        bytes += await preloadSceneImage(url, previousEntryCounts.get(url) ?? 0)
        loaded += 1
        setImagePreloadProgress({ loaded, total: urls.length, bytes })
      }
    }

    await Promise.all(Array.from({ length: Math.min(4, urls.length) }, () => worker()))
    setImagePreloadState('complete')
  }

  const requestImagePreload = () => setIsImagePreloadDialogOpen(true)
  const confirmImagePreload = () => {
    setIsImagePreloadDialogOpen(false)
    void preloadAllSceneImages()
  }

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
  const playResultVisible = phase === 'between' && sceneIsFinalStep
  const playResultItems = scenario.context.completionRecords.length > 0 ? scenario.context.completionRecords : [records.at(-1)?.result ?? '']
  const playResultTotal = playResultItems.reduce((total, item) => total + (resolvePlayResultCode(item ?? '').score ?? 0), 0)
  const playResultTotalTone = playResultTotal > 0 ? 'positive' : playResultTotal < 0 ? 'negative' : 'zero'
  const sceneCurrentStage = sceneAnnouncementStages[sceneStep]
  const sceneEventIndex = sceneAnnouncementCount === 0 ? -1 : sceneCurrentStage.announcementIndex
  const sceneIsDetailStep = replay !== null || sceneAnnouncementCount === 0 || sceneCurrentStage.showDetail
  const sceneIsChoiceViewStep = sceneCurrentStage && 'showChoiceView' in sceneCurrentStage && sceneCurrentStage.showChoiceView
  const sceneRevealedCount = sceneAnnouncementCount === 0 ? 0 : sceneIsFinalStep ? sceneAnnouncementCount : sceneEventIndex + 1
  const currentAnnouncement = sceneAnnouncements[sceneEventIndex]
  const shouldUseViewImageForMain = shouldUseViewImageForAnnouncementStep(currentAnnouncement, isSurpriseScene)
  const sceneDetailScene = resolveAnnouncementDetailSceneId(currentAnnouncement)
  const sceneDetailAnnouncement = sceneDetailScene
    ? { title: currentAnnouncement!.title, scene: sceneDetailScene }
    : undefined
  const shouldUseChoiceViewImage = sceneIsChoiceViewStep
  const sceneDetailImageUrl = shouldUseChoiceViewImage
    ? resolveViewImage(sceneDetailView)
    : shouldUseViewImageForMain
      ? resolveViewImage(sceneDetailView)
    : resolveAnnouncementDetailImage(currentAnnouncement, resolveAnnouncementImageBase(currentAnnouncement, displayedState.context.playerBase)) ?? resolveViewImage(sceneDetailView)
  const shareDetailSceneForTitle = shouldShareDetailSceneForTitle(currentAnnouncement) && Boolean(sceneDetailAnnouncement && sceneDetailImageUrl)
  const sceneMissingImageName = sceneIsDetailStep || shouldUseViewImageForMain || shareDetailSceneForTitle
    ? (sceneDetailImageUrl ? undefined : shouldUseChoiceViewImage
      ? resolveViewImageFilename(sceneDetailView)
      : resolveAnnouncementDetailImageFilename(currentAnnouncement, resolveAnnouncementImageBase(currentAnnouncement, displayedState.context.playerBase)) ?? resolveViewImageFilename(sceneDetailView))
    : (() => {
      if (!currentAnnouncement) return undefined
      const imageBase = resolveAnnouncementImageBase(currentAnnouncement, displayedState.context.playerBase)
      const expectedImage = resolveSceneImage(currentAnnouncement, imageBase)
      return expectedImage ? undefined : resolveSceneImageFilename(currentAnnouncement, imageBase)
    })()
  const sceneImageUrl = sceneMissingImageName ? undefined : (sceneIsDetailStep || shouldUseViewImageForMain || shareDetailSceneForTitle ? sceneDetailImageUrl : sceneImageTrail[sceneEventIndex])
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
    setSelectedBattingCategory(null)
    setSituation(nextSituation)
    setSituationPlayerBase(null)
    setPlateStartSituation(nextSituation)
    const initialScenario = startScenario(OFFENSE_CORE_PACK, createScenarioContext(nextSituation), { manualChance: adminMode })
    setScenario(initialScenario)
    setPlateReplayFrames([{
      stepIndex: 0,
      label: `시작 · ${describeSituation(nextSituation)}`,
      state: initialScenario,
      options: getReplayOptions(initialScenario),
    }])
    setPhase('playing')
  }

  const resetGame = () => {
    setSelectedBattingCategory(null)
    setPlateAppearance(1)
    setRecords([])
    setReplay(null)
    setReplayReturnPhase(null)
    restartAt(createRandomSituation())
  }

  const completeScenario = (state: ScenarioState, replayFrames = plateReplayFrames) => {
    const items = state.context.completionRecords.length > 0
      ? [...state.context.completionRecords]
      : [state.context.selectedLabel || '플레이 완료']
    const result = items.join('\n')
    setPlayResultReady(false)
    const finalFrames = [
      ...replayFrames,
      {
        stepIndex: replayFrames.length,
        label: '플레이 완료',
        state,
        options: [],
      },
    ]
    setRecords((current) => [...current, {
      number: plateAppearance,
      situation: describeSituation(plateStartSituation),
      decision: state.context.selectedLabel ?? '타격',
      result,
      items,
      frames: finalFrames,
    }])
    setScenario(state)
    setPhase('between')
  }

  const setBattingInputMode = (mode: BattingInputMode) => {
    setSelectedBattingCategory(null)
    setBattingInputModeState(mode)
    saveBattingInputMode(mode)
  }

  const acceptState = (next: ScenarioState, selectedAction?: { id: string; kind: 'batting' | 'choice' | 'chance' }) => {
    setSelectedBattingCategory(null)
    const terminal = OFFENSE_CORE_PACK.nodes[next.nodeId].type === 'terminal'
    setSituation({ outs: scenario.context.outs, bases: scenario.context.bases as Base[] })
    setSituationPlayerBase(scenario.context.playerBase)
    setScenario(next)
    const previous = plateReplayFrames.at(-1)
    const selectedFrame = previous && selectedAction
      ? { ...previous, options: previous.options.map((option) => ({ ...option, chosen: option.kind === selectedAction.kind && option.id === selectedAction.id })) }
      : previous
    const nextFrame = {
      stepIndex: plateReplayFrames.length,
      label: next.context.selectedLabel || '진행',
      state: next,
      options: getReplayOptions(next),
    }
    const nextReplayFrames = selectedFrame
      ? [...plateReplayFrames.slice(0, -1), selectedFrame, nextFrame]
      : [...plateReplayFrames, nextFrame]
    setPlateReplayFrames(nextReplayFrames)
    if (terminal) completeScenario(next, nextReplayFrames)
  }

  const chooseBatting = (eventId: BattingEventId, customLabel?: string) =>
    acceptState(selectScenarioBattingEvent(OFFENSE_CORE_PACK, scenario, eventId, { manualChance: adminMode, selectedLabel: customLabel }), { id: eventId, kind: 'batting' })

  const chooseProbabilisticBatting = (choiceId: ProbabilisticBattingChoice) => {
    const config = PROBABILISTIC_BATTING_CHOICES.find((item) => item.id === choiceId)
    if (!config) return
    const eventId = resolveProbabilisticBattingChoice(choiceId)
    chooseBatting(eventId, config.label)
  }

  const chooseOption = (choiceId: string) => acceptState(chooseScenarioOption(OFFENSE_CORE_PACK, scenario, choiceId, { manualChance: adminMode }), { id: choiceId, kind: 'choice' })
  const chooseChanceOutcome = (outcomeId: string) => acceptState(chooseScenarioChanceOutcome(OFFENSE_CORE_PACK, scenario, outcomeId, { manualChance: adminMode }), { id: outcomeId, kind: 'chance' })
  const toggleAdminMode = (enabled: boolean) => {
    setAdminMode(enabled)
    if (!enabled && OFFENSE_CORE_PACK.nodes[scenario.nodeId].type === 'chance') {
      acceptState(settleScenario(OFFENSE_CORE_PACK, scenario))
    }
  }

  const closeReplay = () => {
    setReplay(null)
    if (replayReturnPhase) {
      setPhase(replayReturnPhase)
      setReplayReturnPhase(null)
    }
  }

  const startPlateReplay = (record: RecordEntry) => {
    if (!record.frames || record.frames.length === 0) return
    const firstState = record.frames[0]?.state ?? scenario
    setReplayReturnPhase('finished')
    setPlateAppearance(record.number)
    setSituation({ outs: firstState.context.outs, bases: firstState.context.bases as Base[] })
    setScenario(firstState)
    setPhase('playing')
    setReplay({ frames: record.frames, index: 0, playing: false })
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

  useEffect(() => {
    if (!playResultVisible) return
    const timer = window.setTimeout(() => setPlayResultReady(true), 550)
    return () => window.clearTimeout(timer)
  }, [playResultVisible])

  if (phase === 'finished') {
    const grandTotal = records.reduce((grandSum, record) => {
      const plateSum = (record.items ?? []).reduce((sum, item) => sum + (resolvePlayResultCode(item ?? '').score ?? 0), 0)
      return grandSum + plateSum
    }, 0)
    const grandTotalTone = grandTotal > 0 ? 'positive' : grandTotal < 0 ? 'negative' : 'zero'
    const formattedGrandTotal = grandTotal > 0 ? `+${grandTotal}` : `${grandTotal}`

    return (
      <main className="app-shell result-page">
        <header className="brand-bar">
          <div className="brand-title">
            <img className="brand-logo" src={logoImage} alt="" />
            <span>EPS Simulator</span>
          </div>
          <div className="header-controls">
            <button className="secondary-button" type="button" onClick={() => setAppMode('codeMapping')}>코드 매핑 보기</button>
            <button className="icon-button" type="button" onClick={resetGame} title="새 경기" aria-label="새 경기">
              <RotateCcw size={18} />
            </button>
          </div>
        </header>

        <section className="final-report-hero">
          <div className="final-hero-left">
            <p className="eyebrow">FINAL REPORT</p>
            <h1>최종 결산</h1>
            <p className="final-hero-desc">각 타석별 발생 항목과 채점 결과를 집계한 최종 리포트입니다.</p>
          </div>
          <div className={`final-grand-total-box play-result-score-${grandTotalTone}`}>
            <span className="grand-total-label">최종 누적 점수</span>
            <strong className="grand-total-value">{formattedGrandTotal}</strong>
            <span className="grand-total-unit">TOTAL SCORE</span>
          </div>
        </section>

        <section className="final-plate-grid" aria-label="타석별 상세 결산">
          {records.map((record) => {
            const items = record.items ?? (record.result ? record.result.split('\n') : [])
            const plateTotal = items.reduce((sum, item) => sum + (resolvePlayResultCode(item ?? '').score ?? 0), 0)
            const plateTotalTone = plateTotal > 0 ? 'positive' : plateTotal < 0 ? 'negative' : 'zero'
            const formattedPlateTotal = plateTotal > 0 ? `+${plateTotal}` : `${plateTotal}`

            return (
              <article
                className="final-plate-card replayable-card"
                key={record.number}
                onClick={() => startPlateReplay(record)}
                role="button"
                tabIndex={0}
                aria-label={`타석 ${record.number} 시뮬레이션 다시보기`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    startPlateReplay(record)
                  }
                }}
              >
                <div className="final-plate-header">
                  <strong className="final-plate-title">타석 {record.number}</strong>
                  <span className="final-plate-replay-hint"><Play size={12} /> 다시보기</span>
                </div>

                <div className="play-result-record" aria-label={`0${record.number} 타석 결산 표`}>
                  <div className="play-result-columns">
                    <span>항목</span>
                    <span>코드</span>
                    <span>점수</span>
                  </div>
                  {items.map((item, idx) => {
                    const resolved = resolvePlayResultCode(item ?? '')
                    const scoreTone = resolved.score === null ? 'unscored' : resolved.score > 0 ? 'positive' : resolved.score < 0 ? 'negative' : 'zero'
                    const scoreText = resolved.score !== null ? (resolved.score > 0 ? `+${resolved.score}` : `${resolved.score}`) : ''
                    return (
                      <div className="play-result-entry" key={`${item}:${idx}`}>
                        <strong>{item}</strong>
                        <span className={`play-result-code play-result-score-${scoreTone}`}>
                          <b>{resolved.code}</b>
                        </span>
                        <span className={`play-result-score-${scoreTone}`}>
                          {scoreText}
                        </span>
                      </div>
                    )
                  })}
                  <div className="play-result-total">
                    <span>합계</span>
                    <b className={`play-result-score-${plateTotalTone}`}>{formattedPlateTotal}</b>
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <div className="final-action-bar">
          <button className="primary-button restart-button" type="button" onClick={resetGame}>
            <RotateCcw size={18} /> 새 경기 시작
          </button>
        </div>
      </main>
    )
  }

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
    ? node.description.startsWith(`${currentViewBase}루 주자:`) ? formatScenarioText(node.description, displayedState.context.playerBase) : `${currentViewBase}루 주자: ${formatScenarioText(node.description, displayedState.context.playerBase)}`
    : node.type === 'choice' ? formatScenarioText(node.description, displayedState.context.playerBase) : undefined
  const surpriseOverlayImageUrl = surpriseOverlayAnnouncement
    ? resolveSceneImage(surpriseOverlayAnnouncement, resolveAnnouncementImageBase(surpriseOverlayAnnouncement, displayedState.context.playerBase))
    : undefined
  const surpriseOverlayImageName = surpriseOverlayAnnouncement
    ? resolveSceneImageFilename(surpriseOverlayAnnouncement, resolveAnnouncementImageBase(surpriseOverlayAnnouncement, displayedState.context.playerBase))
    : undefined
  const announcementRenderKey = `${displayedState.context.announcementHistory.length}:${displayedState.context.announcement?.title ?? ''}:${displayedState.context.announcement?.detail ?? ''}`
  const canAct = phase === 'playing' && (sceneIsFinalStep || adminMode && sceneNode.type === 'chance')
  const isNormalChoiceOverlayVisible = canAct && !replaying && node.type === 'choice' && !isSurpriseEvent && availableChoices.length > 0
  const showPlayResult = playResultVisible && playResultReady
  const backgroundDimmingDelay = isNormalChoiceOverlayVisible ? overlayMessages.length > 1 ? 1410 : overlayMessages.length > 0 ? 770 : 520 : showPlayResult ? 0 : undefined
  const nextSceneId = currentAnnouncement ? resolveSceneId(currentAnnouncement) : undefined
  const transition = resolveSceneTransitionState({
    view: sceneIsFinalStep ? sceneDetailView : sceneImageView,
    sceneId: nextSceneId,
    advance: sceneIsFinalStep ? resolveAdvanceConcept(currentAnnouncement ?? displayedState.context.announcement) : undefined,
    preserveImage: shareDetailSceneForTitle,
    sequenceKey: sceneSequenceKey,
  })
  const actionInstruction = node.type === 'batting'
    ? adminMode && node.mode === 'random'
      ? '관리자: 후속 타자 결과를 지정하세요.'
      : battingInputMode === 'probabilistic'
        ? '타격 방침을 선택해주세요.'
        : '타격 결과를 선택해주세요.'
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

  if (appMode === 'codeMapping') return <CodeMappingMode onBack={() => setAppMode('game')} />

  return <>
    <main className="app-shell">
    <header className="brand-bar"><div className="brand-title"><img className="brand-logo" src={logoImage} alt="" /><span>EPS Simulator</span></div><div className="header-controls"><button className="secondary-button" type="button" onClick={() => setAppMode('codeMapping')}>코드 매핑 보기</button><div className="image-preload-control"><button className="secondary-button" type="button" onClick={requestImagePreload} disabled={imagePreloadState === 'loading'}><Download size={14} />{imagePreloadState === 'loading' ? `이미지 ${imagePreloadProgress.loaded}/${imagePreloadProgress.total}` : imagePreloadState === 'complete' ? '이미지 준비 완료' : '이미지 준비'}</button>{imagePreloadState !== 'idle' && <small>{formatDataSize(imagePreloadProgress.bytes)} 사용</small>}</div><label className="admin-toggle"><SlidersHorizontal size={14} /><span>관리자</span><input type="checkbox" checked={adminMode} onChange={(event) => toggleAdminMode(event.target.checked)} aria-label="관리자 콘솔" /><i /></label><button className="icon-button" type="button" onClick={resetGame} title="새 경기" aria-label="새 경기"><RotateCcw size={18} /></button></div></header>
    <div className={`game-grid ${sceneIsFinalStep ? '' : 'game-grid-tappable'} ${isSurpriseEvent ? 'surprise-overlay-visible' : ''}`} {...sceneTapProps}>
      <MediaStage situation={displayedSituation} plateAppearance={plateAppearance} playerBase={displayedPlayerBase} imageUrl={sceneImageUrl} viewLabel={highlightedViewLabel} isSurpriseEvent={isSurpriseEvent} isPlateEntry={isPlateEntry} missingImageName={sceneMissingImageName} transition={transition} backgroundDimmingDelay={backgroundDimmingDelay} backgroundDimmingKey={`${displayedState.nodeId}:${announcementRenderKey}:${showPlayResult}`} hideBroadcastBug={showPlayResult} />
      <section className={`decision-panel ${isPlateEntry ? 'plate-entry-panel' : ''} ${isSurpriseEvent ? 'surprise-event-panel' : ''} ${overlayMessages.length > 0 ? 'has-announcement' : ''} ${overlayMessages.length > 1 ? 'has-compound-announcement' : ''}`}>
        {overlayMessages.length > 0 && <aside className={`result-notice ${overlayMessages.at(-1)?.tone ?? 'neutral'}`} aria-live="polite" key={replaying ? `replay:${replayFrame?.stepIndex ?? 'live'}` : sceneSequenceKey}>
          <span>{replaying ? '아나운스 재생' : '방금 일어난 일'}</span>
          <div className="notice-stack">
            <div className="message-flow">
              {overlayMessages.map((message, index) => {
                const showMessageDetail = replaying || index < sceneEventIndex || (index === sceneEventIndex && sceneIsDetailStep)
                const matchedResultCode = matchAnnouncementToResultCode(message)
                const isSacrificeFlyAnnouncement = message.title.includes('태그업 성공!')
                  && displayedState.context.completionRecords.includes(PLAY_RESULT_ITEMS.sacrificeFly)
                const announcementResultCode = matchedResultCode ?? (isSacrificeFlyAnnouncement ? resolvePlayResultCode(PLAY_RESULT_ITEMS.sacrificeFly) : null)
                const isFollowUpAnnouncement = message.title.includes('후속 타자') || message.title.includes('후속타자') || message.title === '뜬공 처리 성공!'
                const resultCode = !isFollowUpAnnouncement && announcementResultCode && displayedState.context.completionRecords.includes(announcementResultCode.item)
                  ? announcementResultCode
                  : null
                const scoreTone = resultCode?.score === null || resultCode?.score === undefined ? 'unscored' : resultCode.score > 0 ? 'positive' : resultCode.score < 0 ? 'negative' : 'zero'
                const scoreText = resultCode?.score !== null && resultCode?.score !== undefined ? formatAnnouncementScore(resultCode.score) : ''

                return <div className="message-flow-entry" key={`${message.title}:${message.detail}:${index}`}>
                  {index > 0 && <span className="message-flow-connector" style={{ animationDelay: `${0.31 + (index - 1) * 0.43}s` }}>그리고</span>}
                  <div className={`message-flow-message ${message.category === 'surprise' ? 'surprise-message' : 'normal-message'} ${message.tone ?? 'neutral'}`} style={{ animationDelay: `${0.1 + index * 0.43}s` }}>
                    <div className="message-title-row">
                      <strong>{message.title}</strong>
                      {(resultCode?.code || scoreText !== '') && (
                        <div className="message-title-badges">
                          {resultCode && resultCode.code && (
                            <span className={`announcement-code-badge play-result-score-${scoreTone}`}>
                              <b>{resultCode.code}</b>
                            </span>
                          )}
                          {scoreText !== '' && (
                            <span className={`announcement-score-badge play-result-score-${scoreTone}`} aria-label={`점수 ${scoreText}`}>
                              <span>{scoreText}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {showMessageDetail && (
                      <div className="message-detail-row">
                        <p>{message.detail}</p>
                      </div>
                    )}
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
        {canAct && actionInstruction && <p className={`action-instruction ${node.type === 'choice' || node.type === 'batting' ? 'choice-instruction' : ''}`} key={`${displayedState.nodeId}:${actionInstruction}:${announcementRenderKey}`}>{actionInstruction}</p>}
        {replaying && replayFrame && replayFrame.options.length > 0 && <div className={`choices replay-choices ${replayFrame.options.some((option) => option.kind === 'chance') ? 'replay-chance-choices' : ''}`}>{replayFrame.options.map((option) => <button type="button" key={option.id} disabled className={option.chosen ? 'chosen' : ''}><span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span><ChevronRight size={18} /></button>)}</div>}
        {canAct && !replaying && node.type === 'batting' && (node.mode === 'direct' || adminMode) && (
          <div className={`batting-container ${adminMode && node.mode === 'random' ? 'admin-batting-container' : ''}`} key={`choices:${displayedState.nodeId}:${announcementRenderKey}`}>
            {!adminMode && (
              <div className="batting-mode-toggle" role="radiogroup" aria-label="타격 모드 선택">
                <button
                  type="button"
                  className={`mode-toggle-chip ${battingInputMode === 'probabilistic' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedBattingCategory(null)
                    setBattingInputMode('probabilistic')
                  }}
                >
                  확률형
                </button>
                <button
                  type="button"
                  className={`mode-toggle-chip ${battingInputMode === 'direct' ? 'active' : ''}`}
                  onClick={() => setBattingInputMode('direct')}
                >
                  결과확정형
                </button>
              </div>
            )}
            {battingInputMode === 'probabilistic' && !adminMode ? (
              <div className="choices probabilistic-choices">
                {PROBABILISTIC_BATTING_CHOICES.map((choice) => (
                  <button type="button" onClick={() => chooseProbabilisticBatting(choice.id)} key={choice.id}>
                    <span>
                      <strong>{choice.label}</strong>
                      <small>{choice.description}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            ) : selectedBattingCategory === null ? (
              <div className="choices batting-category-choices">
                {BATTING_CATEGORIES.map((category) => {
                  const matchingEvents = BATTING_EVENTS.filter(
                    (event) =>
                      category.eventIds.includes(event.kind) &&
                      node.eventIds.includes(event.kind) &&
                      (node.mode === 'random' ? adminMode : true)
                  )
                  if (matchingEvents.length === 0) return null
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedBattingCategory(category.id)}
                      key={category.id}
                      className="category-choice-button"
                    >
                      <span>
                        <strong>{category.label}</strong>
                        <small>{category.description}</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="batting-subcategory-wrapper">
                <div className="batting-subcategory-header">
                  <button
                    type="button"
                    className="category-back-chip"
                    onClick={() => setSelectedBattingCategory(null)}
                    aria-label="카테고리 선택으로 돌아가기"
                  >
                    <ChevronLeft size={16} />
                    <span>카테고리: {BATTING_CATEGORIES.find((c) => c.id === selectedBattingCategory)?.label}</span>
                  </button>
                </div>
                <div className="choices batting-subcategory-choices">
                  {BATTING_EVENTS.filter(
                    (event) =>
                      node.eventIds.includes(event.kind) &&
                      (node.mode === 'random' ? adminMode : true) &&
                      BATTING_CATEGORIES.find((c) => c.id === selectedBattingCategory)?.eventIds.includes(event.kind)
                  ).map((event) => (
                    <button type="button" onClick={() => chooseBatting(event.kind)} key={event.kind}>
                      <span><strong>{event.label}</strong><small>{event.description}</small></span><ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {canAct && !replaying && node.type === 'choice' && <div className={`choices runner-choices ${availableChoices.length === 1 ? 'single-choice' : ''}`} key={`choices:${displayedState.nodeId}:${announcementRenderKey}`}>{availableChoices.map((choice) => (
          <button type="button" onClick={() => chooseOption(choice.id)} key={choice.id}><span><strong>{choice.label}</strong>{choice.description && <small>{choice.description}</small>}</span><ChevronRight size={18} /></button>
        ))}</div>}
        {canAct && !replaying && adminMode && node.type === 'chance' && <div className="admin-console" key={`choices:${displayedState.nodeId}:${announcementRenderKey}`} onClick={(event) => event.stopPropagation()}><span>관리자 콘솔 · 확률 결과 선택</span><div className={`choices runner-choices ${node.outcomes.length === 1 ? 'single-choice' : ''}`}>{node.outcomes.map((outcome) => (
          <button type="button" onClick={() => chooseChanceOutcome(outcome.id)} key={outcome.id}><span><strong>{outcome.label ?? `${node.title} ${outcome.id}`}</strong><small>확률 {Math.round(outcome.weight * 100)}%</small></span><ChevronRight size={18} /></button>
        ))}</div></div>}
        {showPlayResult && <section className="play-result" aria-live="polite">
          <h2>이번 타석 결산</h2>
          <div className="play-result-record" aria-label="플레이 점수 기록">
            <div className="play-result-columns"><span>항목</span><span>코드</span><span>점수</span></div>
            {playResultItems.map((item, index) => {
              const resolved = resolvePlayResultCode(item ?? '')
              const scoreTone = resolved.score === null ? 'unscored' : resolved.score > 0 ? 'positive' : resolved.score < 0 ? 'negative' : 'zero'
              return <div className="play-result-entry" key={`${item}:${index}`}><strong>{item}</strong><span className={`play-result-code play-result-score-${scoreTone}`}><b>{resolved.code}</b></span><span className={`play-result-score-${scoreTone}`}>{resolved.score ?? ''}</span></div>
            })}
            <div className="play-result-total"><span>점수 합계</span><b className={`play-result-score-${playResultTotalTone}`}>{playResultTotal > 0 ? '+' : ''}{playResultTotal}</b></div>
          </div>
          <button className="primary-button" type="button" onClick={continueGame}>{plateAppearance === 3 ? '결과 보기' : '다음 타석'} <ChevronRight size={18} /></button>
        </section>}
      </section>
    </div>
    {replay && <div className="replay-controls" role="group" aria-label="아나운스 재생 컨트롤">
      <span className="replay-step-label"><b>{replay.index + 1}/{replay.frames.length}</b>{replayFrame?.label}</span>
      <div className="replay-buttons">
        <button type="button" onClick={() => setReplay((current) => current && { ...current, playing: false, index: Math.max(0, current.index - 1) })} disabled={replay.index === 0}><SkipBack size={16} /> 이전 단계</button>
        <button className={replay.playing ? 'replay-auto-on' : ''} type="button" onClick={() => setReplay((current) => current && { ...current, playing: !current.playing })}>{replay.playing ? <Pause size={16} /> : <Play size={16} />} {replay.playing ? '자동 재생 중' : '자동 재생'}</button>
        <button type="button" onClick={() => setReplay((current) => current && { ...current, playing: false, index: Math.min(current.frames.length - 1, current.index + 1) })} disabled={replayAtEnd}>다음 단계 <SkipForward size={16} /></button>
        {replayAtEnd && replayReturnPhase ? (
          <button className="replay-ok-button" type="button" onClick={closeReplay}>
            <CheckCircle2 size={16} /> 결산으로 돌아가기
          </button>
        ) : (
          <button type="button" onClick={closeReplay}>재생 종료</button>
        )}
      </div>
    </div>}
    <footer className="progress-strip">{[1, 2, 3].map((item) => <div className={item < plateAppearance || phase === 'between' && item === plateAppearance ? 'complete' : item === plateAppearance ? 'active' : ''} key={item}><span>0{item}</span><i /><p>{records[item - 1]?.result ?? (item === plateAppearance ? '진행 중' : '대기')}</p></div>)}</footer>
    </main>
    {isImagePreloadDialogOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsImagePreloadDialogOpen(false) }}>
      <section className="preload-dialog" role="dialog" aria-modal="true" aria-labelledby="preload-dialog-title">
        <button className="dialog-close-button" type="button" onClick={() => setIsImagePreloadDialogOpen(false)} aria-label="이미지 준비 확인창 닫기"><X size={18} /></button>
        <Download className="preload-dialog-icon" size={24} aria-hidden="true" />
        <p className="eyebrow">IMAGE CACHE</p>
        <h2 id="preload-dialog-title">이미지를 미리 준비할까요?</h2>
        <p>게임 중 장면 전환이 부드럽도록 모든 장면 이미지를 한 번에 로딩합니다.</p>
        <div className="preload-dialog-estimate"><span>예상 데이터 소모량</span><strong>약 {formatDataSize(ESTIMATED_SCENE_IMAGE_BYTES)}</strong></div>
        <small>실제 사용량은 브라우저 캐시와 네트워크 압축에 따라 달라질 수 있습니다.</small>
        <div className="preload-dialog-actions"><button className="secondary-button" type="button" onClick={() => setIsImagePreloadDialogOpen(false)}>취소</button><button className="primary-button" type="button" onClick={confirmImagePreload}><Download size={15} />이미지 준비</button></div>
      </section>
    </div>}
  </>
}

export default App
