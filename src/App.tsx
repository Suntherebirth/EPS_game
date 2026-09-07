import { ChevronRight, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
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
import './App.css'

type Phase = 'playing' | 'between' | 'finished'
type RecordEntry = { number: number; situation: string; decision: string; result: string; runs: number }
type Stats = { runs: number; hits: number; outs: number }

function BaseDiamond({ bases, playerBase }: { bases: Base[]; playerBase?: number | null }) {
  return <div className="diamond" aria-label={describeBases(bases)}>
    <span className={`base base-second ${bases.includes(2) ? 'occupied' : ''} ${playerBase === 2 ? 'player-base' : ''}`} />
    <span className={`base base-third ${bases.includes(3) ? 'occupied' : ''} ${playerBase === 3 ? 'player-base' : ''}`} />
    <span className={`base base-first ${bases.includes(1) ? 'occupied' : ''} ${playerBase === 1 ? 'player-base' : ''}`} />
  </div>
}

function MediaStage({ situation, plateAppearance, playerBase, videoUrl }: { situation: Situation; plateAppearance: number; playerBase: number | null; videoUrl?: string }) {
  return <section className="media-stage" aria-live="polite">
    {videoUrl && <video src={videoUrl} autoPlay muted playsInline controls />}
    <div className="broadcast-watermark"><strong>EPS</strong><span>LIVE</span></div>
    <div className="broadcast-bug">
      <div className="broadcast-plate"><span>공격</span><strong>{plateAppearance}<small>/3</small></strong></div>
      <div className="broadcast-runners"><BaseDiamond bases={situation.bases} playerBase={playerBase} /></div>
      <div className="broadcast-outs"><span>OUT</span><div>{[0, 1, 2].map((out) => <i className={out < situation.outs ? 'on' : ''} key={out} />)}</div></div>
    </div>
  </section>
}

function App() {
  const [adminMode, setAdminMode] = useState(false)
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
    const result = state.context.completionRecords.join(' · ') || state.context.selectedLabel || '플레이 완료'
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

  const continueGame = () => {
    if (plateAppearance === 3) {
      setPhase('finished')
      return
    }
    setPlateAppearance((current) => current + 1)
    restartAt(createRandomSituation())
  }

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
  const displayedSituation = { outs: scenario.context.outs, bases: scenario.context.bases as Base[] }
  const currentViewBase = node.tags?.includes('player-position-view') ? scenario.context.playerBase : node.view.split(':')[1] === 'first' ? 1 : node.view.split(':')[1] === 'second' ? 2 : 3
  const viewLabel = node.view.startsWith('runner:') && currentViewBase
    ? `${currentViewBase}루 주자 시점`
    : node.view === 'batter' ? '타석 시점' : null
  const isSurpriseEvent = node.tags?.includes('surprise-event')
  const highlightedViewLabel = isSurpriseEvent && viewLabel ? `${viewLabel} : 돌발 이벤트!` : viewLabel
  const availableChoices = getAvailableScenarioChoices(OFFENSE_CORE_PACK, scenario)
  const actionInstruction = node.type === 'batting'
    ? adminMode && node.mode === 'random' ? '관리자: 후속 타자 결과를 지정하세요.' : '타격 결과를 선택해주세요.'
    : node.type === 'choice'
      ? node.description ?? '주루 방침을 선택해주세요.'
      : node.type === 'chance' && adminMode
        ? '관리자: 확률 결과를 지정하세요.'
      : ''

  return <main className="app-shell">
    <header className="brand-bar"><div><b className="brand-mark">EPS</b><span>BASEBALL SIM</span></div><div className="header-controls"><label className="admin-toggle"><SlidersHorizontal size={14} /><span>관리자</span><input type="checkbox" checked={adminMode} onChange={(event) => toggleAdminMode(event.target.checked)} aria-label="관리자 콘솔" /><i /></label><button className="icon-button" type="button" onClick={resetGame} title="새 경기" aria-label="새 경기"><RotateCcw size={18} /></button></div></header>
    <div className="game-grid">
      <MediaStage situation={displayedSituation} plateAppearance={plateAppearance} playerBase={scenario.context.playerBase} />
      <section className="decision-panel">
        {highlightedViewLabel && <div className="panel-heading"><span className={`view-chip ${isSurpriseEvent ? 'surprise-chip' : ''}`}>{highlightedViewLabel}</span></div>}
        {scenario.context.announcement && <aside className={`result-notice ${scenario.context.announcement.tone ?? 'neutral'}`} aria-live="polite" key={`${scenario.context.announcement.title}:${scenario.context.announcement.detail}`}><span>방금 일어난 일</span><strong>{scenario.context.announcement.title}</strong><p>{scenario.context.announcement.detail}</p></aside>}
        {phase === 'playing' && actionInstruction && <p className="action-instruction">{actionInstruction}</p>}
        {phase === 'playing' && node.type === 'batting' && (node.mode === 'direct' || adminMode) && <div className={`choices batting-choices ${adminMode && node.mode === 'random' ? 'admin-batting-choices' : ''}`}>{BATTING_EVENTS.filter((event) => node.eventIds.includes(event.kind) && (node.mode === 'random' ? adminMode : ['single', 'double', 'triple', 'homeRun', 'walk', 'hitByPitch', 'strikeout', 'groundOut', 'infieldFly', 'flyOut'].includes(event.kind))).map((event, index) => <button type="button" onClick={() => chooseBatting(event.kind)} key={event.kind}><span className="choice-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{event.label}</strong><small>{event.description}</small></span><ChevronRight size={18} /></button>)}</div>}
        {phase === 'playing' && node.type === 'choice' && <div className="choices runner-choices">{availableChoices.map((choice, index) => <button type="button" onClick={() => chooseOption(choice.id)} key={choice.id}><span className="choice-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{choice.label}</strong>{choice.description && <small>{choice.description}</small>}</span><ChevronRight size={18} /></button>)}</div>}
        {phase === 'playing' && adminMode && node.type === 'chance' && <div className="admin-console"><span>관리자 콘솔 · 확률 결과 선택</span><div className="choices runner-choices">{node.outcomes.map((outcome, index) => <button type="button" onClick={() => chooseChanceOutcome(outcome.id)} key={outcome.id}><span className="choice-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{outcome.label ?? `${node.title} ${outcome.id}`}</strong><small>확률 {Math.round(outcome.weight * 100)}%</small></span><ChevronRight size={18} /></button>)}</div></div>}
        {phase === 'between' && <div className="play-result"><p className="eyebrow">PLAY COMPLETE</p><h3>{records.at(-1)?.result}</h3><p>{plateAppearance === 3 ? '모든 타석이 끝났습니다.' : '다음 타석은 새로운 상황에서 시작합니다.'}</p><button className="primary-button" type="button" onClick={continueGame}>{plateAppearance === 3 ? '결과 보기' : '다음 타석'} <ChevronRight size={18} /></button></div>}
      </section>
    </div>
    <footer className="progress-strip">{[1, 2, 3].map((item) => <div className={item < plateAppearance || phase === 'between' && item === plateAppearance ? 'complete' : item === plateAppearance ? 'active' : ''} key={item}><span>0{item}</span><i /><p>{records[item - 1]?.result ?? (item === plateAppearance ? '진행 중' : '대기')}</p></div>)}</footer>
  </main>
}

export default App
