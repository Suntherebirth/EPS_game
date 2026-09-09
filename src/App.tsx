import { Bug, CheckCircle2, ChevronRight, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { createAnnouncementAuditCases, type AnnouncementAuditCase } from './game/announcementAudit'
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
type RecordEntry = { number: number; situation: string; decision: string; result: string; runs: number }
type Stats = { runs: number; hits: number; outs: number }

const ANNOUNCEMENT_AUDIT_STORAGE_KEY = 'eps:announcement-check:completed:v1'

const loadCompletedAnnouncementCases = () => {
  try {
    const value = localStorage.getItem(ANNOUNCEMENT_AUDIT_STORAGE_KEY)
    const parsed = value ? JSON.parse(value) : []
    return new Set<string>(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

const saveCompletedAnnouncementCases = (completed: Set<string>) => {
  localStorage.setItem(ANNOUNCEMENT_AUDIT_STORAGE_KEY, JSON.stringify([...completed]))
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

function AnnouncementCheckMode({ cases, completedCases, hideCompleted, onToggleHideCompleted, onToggleCompleted, onBack }: { cases: AnnouncementAuditCase[]; completedCases: Set<string>; hideCompleted: boolean; onToggleHideCompleted: () => void; onToggleCompleted: (id: string, completed: boolean) => void; onBack: () => void }) {
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null)
  const visibleCases = hideCompleted ? cases.filter((item) => !completedCases.has(item.id)) : cases
  const completedCount = cases.filter((item) => completedCases.has(item.id)).length

  const copyBugReport = async (item: AnnouncementAuditCase) => {
    await copyTextToClipboard(formatAnnouncementBugReport(item))
    setCopiedReportId(item.id)
    window.setTimeout(() => setCopiedReportId((current) => current === item.id ? null : current), 1600)
  }

  return <main className="app-shell audit-page">
    <header className="brand-bar audit-header"><button className="brand-title" type="button" onClick={onBack}><b className="brand-mark">EPS</b><span>BASEBALL SIM</span></button><div className="header-controls"><button className="secondary-button" type="button" onClick={onToggleHideCompleted}>{hideCompleted ? '완료 숨김' : '전체 보기'}</button><button className="icon-button" type="button" onClick={onBack} title="게임으로 돌아가기" aria-label="게임으로 돌아가기"><RotateCcw size={18} /></button></div></header>
    <section className="audit-summary">
      <p className="eyebrow">ANNOUNCEMENT CHECK</p>
      <h1>아나운스 텍스트 체크</h1>
      <p>같은 표시 상황과 같은 메시지 흐름은 하나로 묶었습니다.</p>
      <div className="audit-metrics"><div><strong>{cases.length}</strong><span>전체</span></div><div><strong>{cases.length - completedCount}</strong><span>남음</span></div><div><strong>{completedCount}</strong><span>완료</span></div></div>
    </section>
    <section className="audit-list" aria-label="아나운스 체크 목록">
      {visibleCases.map((item) => {
        const completed = completedCases.has(item.id)
        return <article className={`audit-card ${completed ? 'completed' : ''} ${item.isSurprise ? 'surprise' : ''}`} key={item.id}>
          <div className="audit-card-meta"><span>{item.situation}</span><span>{item.viewLabel}</span>{item.isSurprise && <b>돌발 이벤트</b>}</div>
          <div className="audit-message-flow">
            {item.messages.map((message, index) => <div className={`audit-message ${message.category === 'surprise' ? 'surprise-message' : ''} ${message.tone ?? 'neutral'}`} key={`${message.title}:${message.detail}:${index}`}>
              {index > 0 && <span>그리고</span>}
              <strong>{message.title}</strong>
              <p>{message.detail}</p>
            </div>)}
          </div>
          <div className="audit-card-footer"><small>{item.actionLabel}</small><div className="audit-card-actions"><button className="secondary-button" type="button" onClick={() => void copyBugReport(item)}><Bug size={16} /> {copiedReportId === item.id ? '복사됨' : '버그 리포트'}</button><button className={completed ? 'secondary-button' : 'primary-button'} type="button" onClick={() => onToggleCompleted(item.id, !completed)}>{completed ? '완료 해제' : <><CheckCircle2 size={17} /> 문제 없음</>}</button></div></div>
        </article>
      })}
      {visibleCases.length === 0 && <div className="audit-empty"><strong>확인할 아나운스가 없습니다.</strong><p>완료 숨김을 끄면 전체 목록을 다시 볼 수 있습니다.</p></div>}
    </section>
  </main>
}

function App() {
  const [appMode, setAppMode] = useState<AppMode>('game')
  const [adminMode, setAdminMode] = useState(false)
  const [announcementAuditCases] = useState(() => createAnnouncementAuditCases())
  const [completedAnnouncementCases, setCompletedAnnouncementCases] = useState(() => loadCompletedAnnouncementCases())
  const [hideCompletedAnnouncements, setHideCompletedAnnouncements] = useState(true)
  const [plateAppearance, setPlateAppearance] = useState(1)
  const [phase, setPhase] = useState<Phase>('playing')
  const [situation, setSituation] = useState<Situation>(() => createRandomSituation())
  const [scenario, setScenario] = useState<ScenarioState>(() => startScenario(OFFENSE_CORE_PACK, createScenarioContext(situation), { manualChance: adminMode }))
  const [stats, setStats] = useState<Stats>({ runs: 0, hits: 0, outs: 0 })
  const [records, setRecords] = useState<RecordEntry[]>([])

  const restartAt = (nextSituation: Situation) => {
    setSituation(nextSituation)
    setScenario(startScenario(OFFENSE_CORE_PACK, createScenarioContext(nextSituation), { manualChance: adminMode }))
    setPhase('playing')
  }

  const resetGame = () => {
    setPlateAppearance(1)
    setStats({ runs: 0, hits: 0, outs: 0 })
    setRecords([])
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

  const toggleCompletedAnnouncementCase = (id: string, completed: boolean) => {
    setCompletedAnnouncementCases((current) => {
      const next = new Set(current)
      if (completed) next.add(id)
      else next.delete(id)
      saveCompletedAnnouncementCases(next)
      return next
    })
  }

  const continueGame = () => {
    if (plateAppearance === 3) {
      setPhase('finished')
      return
    }
    setPlateAppearance((current) => current + 1)
    restartAt(createRandomSituation())
  }

  if (appMode === 'announcementCheck') return <AnnouncementCheckMode cases={announcementAuditCases} completedCases={completedAnnouncementCases} hideCompleted={hideCompletedAnnouncements} onToggleHideCompleted={() => setHideCompletedAnnouncements((current) => !current)} onToggleCompleted={toggleCompletedAnnouncementCase} onBack={() => setAppMode('game')} />

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

  const node = OFFENSE_CORE_PACK.nodes[scenario.nodeId]
  const isPlateEntry = phase === 'playing' && node.type === 'batting'
  const displayedSituation = { outs: scenario.context.outs, bases: scenario.context.bases as Base[] }
  const nodeViewBase = node.view === 'runner:first' ? 1 : node.view === 'runner:second' ? 2 : node.view === 'runner:third' ? 3 : null
  const currentViewBase = node.tags?.includes('player-position-view') && nodeViewBase === 1 ? scenario.context.playerBase : nodeViewBase
  const imageView = currentViewBase ? `runner:${currentViewBase === 1 ? 'first' : currentViewBase === 2 ? 'second' : 'third'}` : node.view
  const viewLabel = node.view.startsWith('runner:') && currentViewBase
    ? `${currentViewBase}루 주자 시점`
    : node.view === 'batter' ? '타석 시점' : null
  const isSurpriseEvent = node.tags?.includes('surprise-event')
  const highlightedViewLabel = isSurpriseEvent && viewLabel ? `${viewLabel} : 돌발 이벤트!` : viewLabel
  const availableChoices = getAvailableScenarioChoices(OFFENSE_CORE_PACK, scenario)
  const choiceDescription = node.type === 'choice' && isSurpriseEvent && currentViewBase
    ? `${currentViewBase}루 주자: 돌발 상황 대처`
    : node.type === 'choice' && node.tags?.includes('player-position-view') && currentViewBase && node.description
    ? node.description.startsWith(`${currentViewBase}루 주자:`) ? node.description : `${currentViewBase}루 주자: ${node.description}`
    : node.type === 'choice' ? node.description : undefined
  const announcementMessages = scenario.context.announcement
    ? [
        ...scenario.context.announcementHistory.map((entry) => ({ ...entry.announcement, category: entry.category })),
        { ...scenario.context.announcement, category: scenario.context.announcementCategory },
      ]
    : []
  const announcementRenderKey = `${scenario.context.announcementHistory.length}:${scenario.context.announcement?.title ?? ''}:${scenario.context.announcement?.detail ?? ''}`
  const actionInstruction = node.type === 'batting'
    ? adminMode && node.mode === 'random' ? '관리자: 후속 타자 결과를 지정하세요.' : '타격 결과를 선택해주세요.'
    : node.type === 'choice'
      ? choiceDescription ?? '주루 방침을 선택해주세요.'
      : node.type === 'chance' && adminMode
        ? '관리자: 확률 결과를 지정하세요.'
      : ''

  return <main className="app-shell">
    <header className="brand-bar"><button className={`brand-title ${adminMode ? 'audit-entry-enabled' : ''}`} type="button" onClick={() => adminMode && setAppMode('announcementCheck')} aria-label={adminMode ? '아나운스 텍스트 체크 모드 열기' : 'EPS Baseball Sim'}><b className="brand-mark">EPS</b><span>BASEBALL SIM</span></button><div className="header-controls"><label className="admin-toggle"><SlidersHorizontal size={14} /><span>관리자</span><input type="checkbox" checked={adminMode} onChange={(event) => toggleAdminMode(event.target.checked)} aria-label="관리자 콘솔" /><i /></label><button className="icon-button" type="button" onClick={resetGame} title="새 경기" aria-label="새 경기"><RotateCcw size={18} /></button></div></header>
    <div className="game-grid">
      <MediaStage situation={displayedSituation} plateAppearance={plateAppearance} playerBase={scenario.context.playerBase} viewLabel={highlightedViewLabel} isSurpriseEvent={isSurpriseEvent} isPlateEntry={isPlateEntry} imageUrl={VIEW_IMAGES[imageView]} />
      <section className={`decision-panel ${isPlateEntry ? 'plate-entry-panel' : ''} ${isSurpriseEvent ? 'surprise-event-panel' : ''} ${scenario.context.announcement ? 'has-announcement' : ''} ${announcementMessages.length > 1 ? 'has-compound-announcement' : ''}`}>
        {scenario.context.announcement && <aside className={`result-notice ${scenario.context.announcement.tone ?? 'neutral'}`} aria-live="polite" key={`${scenario.context.announcement.title}:${scenario.context.announcement.detail}`}>
          <span>방금 일어난 일</span>
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
        {phase === 'playing' && actionInstruction && <p className={`action-instruction ${node.type === 'choice' ? 'choice-instruction' : ''}`} key={`${scenario.nodeId}:${actionInstruction}:${announcementRenderKey}`}>{actionInstruction}</p>}
        {phase === 'playing' && node.type === 'batting' && (node.mode === 'direct' || adminMode) && <div className={`choices batting-choices ${adminMode && node.mode === 'random' ? 'admin-batting-choices' : ''}`} key={`choices:${scenario.nodeId}:${announcementRenderKey}`}>{BATTING_EVENTS.filter((event) => node.eventIds.includes(event.kind) && (node.mode === 'random' ? adminMode : ['single', 'double', 'triple', 'homeRun', 'walk', 'hitByPitch', 'strikeout', 'groundOut', 'infieldFly', 'flyOut'].includes(event.kind))).map((event) => <button type="button" onClick={() => chooseBatting(event.kind)} key={event.kind}><span><strong>{event.label}</strong><small>{event.description}</small></span><ChevronRight size={18} /></button>)}</div>}
        {phase === 'playing' && node.type === 'choice' && <div className={`choices runner-choices ${availableChoices.length === 1 ? 'single-choice' : ''}`} key={`choices:${scenario.nodeId}:${announcementRenderKey}`}>{availableChoices.map((choice) => <button type="button" onClick={() => chooseOption(choice.id)} key={choice.id}><span><strong>{choice.label}</strong>{choice.description && <small>{choice.description}</small>}</span><ChevronRight size={18} /></button>)}</div>}
        {phase === 'playing' && adminMode && node.type === 'chance' && <div className="admin-console" key={`choices:${scenario.nodeId}:${announcementRenderKey}`}><span>관리자 콘솔 · 확률 결과 선택</span><div className={`choices runner-choices ${node.outcomes.length === 1 ? 'single-choice' : ''}`}>{node.outcomes.map((outcome) => <button type="button" onClick={() => chooseChanceOutcome(outcome.id)} key={outcome.id}><span><strong>{outcome.label ?? `${node.title} ${outcome.id}`}</strong><small>확률 {Math.round(outcome.weight * 100)}%</small></span><ChevronRight size={18} /></button>)}</div></div>}
        {phase === 'between' && <div className="play-result"><p className="eyebrow">PLAY COMPLETE</p><h3>{records.at(-1)?.result}</h3><p>{plateAppearance === 3 ? '모든 타석이 끝났습니다.' : '다음 타석은 새로운 상황에서 시작합니다.'}</p><button className="primary-button" type="button" onClick={continueGame}>{plateAppearance === 3 ? '결과 보기' : '다음 타석'} <ChevronRight size={18} /></button></div>}
      </section>
    </div>
    <footer className="progress-strip">{[1, 2, 3].map((item) => <div className={item < plateAppearance || phase === 'between' && item === plateAppearance ? 'complete' : item === plateAppearance ? 'active' : ''} key={item}><span>0{item}</span><i /><p>{records[item - 1]?.result ?? (item === plateAppearance ? '진행 중' : '대기')}</p></div>)}</footer>
  </main>
}

export default App
