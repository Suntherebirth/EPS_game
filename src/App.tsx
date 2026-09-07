import { ChevronRight, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import {
  BATTING_EVENTS,
  DEFAULT_SETTINGS,
  RUNNING_CHANCES,
  resolveBattingEvent,
  rollSingleRunnerEvent,
  type BattingEventId,
  type GameSettings,
  type Play,
  type RunnerEvent,
} from './game/battingEvents'
import './App.css'

type Base = 1 | 2 | 3
type Phase = 'batting' | 'running' | 'between' | 'finished'
type RunChoice = 'safe' | 'aggressive' | 'hold'
type Situation = { outs: number; bases: Base[] }
type RunnerTurn = { base: Base; isBatter: boolean; event?: RunnerEvent }
type RunnerResult = { base: Base; destination: number; success: boolean; isBatter: boolean; note?: string }
type PendingPlay = { play: Play; runners: RunnerTurn[]; current: number; results: RunnerResult[] }
type RecordEntry = { number: number; situation: string; decision: string; result: string; runs: number }
type Stats = { runs: number; hits: number; outs: number }

const BASES: Base[][] = [[], [1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]

const randomSituation = (): Situation => ({ outs: Math.floor(Math.random() * 3), bases: [...BASES[Math.floor(Math.random() * BASES.length)]] })
const describeBases = (bases: Base[]) => bases.length === 0 ? '주자 없음' : bases.length === 3 ? '만루' : `${bases.join('·')}루 주자`
const describeSituation = (situation: Situation) => `${situation.outs}아웃 · ${describeBases(situation.bases)}`

function BaseDiamond({ bases }: { bases: Base[] }) {
  return <div className="diamond" aria-label={describeBases(bases)}>
    <span className={`base base-second ${bases.includes(2) ? 'occupied' : ''}`} />
    <span className={`base base-third ${bases.includes(3) ? 'occupied' : ''}`} />
    <span className={`base base-first ${bases.includes(1) ? 'occupied' : ''}`} />
  </div>
}

function MediaStage({ situation, plateAppearance, videoUrl }: { situation: Situation; plateAppearance: number; videoUrl?: string }) {
  return <section className="media-stage" aria-live="polite">
    {videoUrl && <video src={videoUrl} autoPlay muted playsInline controls />}
    <div className="broadcast-watermark"><strong>EPS</strong><span>LIVE</span></div>
    <div className="broadcast-bug">
      <div className="broadcast-plate"><span>공격</span><strong>{plateAppearance}<small>/3</small></strong></div>
      <div className="broadcast-runners"><BaseDiamond bases={situation.bases} /></div>
      <div className="broadcast-outs"><span>OUT</span><div>{[0, 1, 2].map((out) => <i className={out < situation.outs ? 'on' : ''} key={out} />)}</div></div>
    </div>
  </section>
}

function App() {
  const [settings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [plateAppearance, setPlateAppearance] = useState(1)
  const [phase, setPhase] = useState<Phase>('batting')
  const [situation, setSituation] = useState<Situation>(() => randomSituation())
  const [pending, setPending] = useState<PendingPlay | null>(null)
  const [batDecision, setBatDecision] = useState('')
  const [stats, setStats] = useState<Stats>({ runs: 0, hits: 0, outs: 0 })
  const [records, setRecords] = useState<RecordEntry[]>([])

  const resetGame = () => {
    setPlateAppearance(1); setPhase('batting'); setSituation(randomSituation()); setPending(null)
    setBatDecision(''); setStats({ runs: 0, hits: 0, outs: 0 }); setRecords([])
  }

  const finishPlateAppearance = (resolvedPlay: Play, runnerResults: RunnerResult[] = [], decision = batDecision) => {
    let runs = 0
    let runnerOuts = 0
    const nextBases = new Set<Base>()
    if (resolvedPlay.kind === 'homeRun') {
      runs = situation.bases.length + 1
    } else if (resolvedPlay.kind === 'walk' || resolvedPlay.kind === 'hitByPitch') {
      const occupied = new Set(situation.bases)
      if (occupied.has(1)) {
        if (occupied.has(2)) { if (occupied.has(3)) runs += 1; occupied.add(3) }
        occupied.add(2)
      }
      occupied.add(1); occupied.forEach((base) => nextBases.add(base))
    } else {
      if (resolvedPlay.advance > 0 && !runnerResults.some((runner) => runner.isBatter)) nextBases.add(resolvedPlay.advance as Base)
      runnerResults.sort((a, b) => b.base - a.base || Number(a.isBatter) - Number(b.isBatter)).forEach((runner) => {
        if (!runner.success) { runnerOuts += 1; return }
        if (runner.destination >= 4) { runs += 1; return }
        let destination = runner.destination as Base
        while (destination > 1 && nextBases.has(destination)) destination = (destination - 1) as Base
        if (!nextBases.has(destination)) nextBases.add(destination)
      })
    }
    const playOuts = resolvedPlay.outs + runnerOuts
    const finalBases = situation.outs + playOuts >= 3 ? [] : [...nextBases].sort() as Base[]
    const eventNote = runnerResults.find((runner) => runner.note)?.note
    const runnerNote = runnerResults.length ? ` · 주루 ${runnerResults.filter((runner) => runner.success).length}성공 ${runnerOuts}아웃` : ''
    const result = `${resolvedPlay.label}${eventNote ? ` · ${eventNote}` : ''}${runnerNote}${runs ? ` · ${runs}득점` : ''}`
    setStats((current) => ({ runs: current.runs + runs, hits: current.hits + Number(resolvedPlay.hit), outs: current.outs + playOuts }))
    setSituation((current) => ({ outs: Math.min(3, current.outs + playOuts), bases: finalBases }))
    setRecords((current) => [...current, { number: plateAppearance, situation: describeSituation(situation), decision, result, runs }])
    setPending(null); setPhase('between')
  }

  const chooseBatting = (choice: BattingEventId) => {
    const resolvedPlay = resolveBattingEvent(choice, settings.battingMode)
    const decision = resolvedPlay.label
    const existingRunners: RunnerTurn[] = [...situation.bases]
      .sort((a, b) => b - a)
      .map((base) => ({ base, isBatter: false }))
    const reachesFirstOnContact = ['single', 'infieldHit', 'infieldError'].includes(resolvedPlay.kind)
    const batterRunner: RunnerTurn[] = reachesFirstOnContact
      ? [{ base: 1, isBatter: true, event: resolvedPlay.kind === 'infieldError' ? 'infieldMisplay' : resolvedPlay.kind === 'single' ? rollSingleRunnerEvent() : 'standard' }]
      : []
    const runners = [...batterRunner, ...existingRunners]
    setBatDecision(decision)
    const canRun = runners.length > 0 && situation.outs + resolvedPlay.outs < 3 && !['homeRun', 'walk', 'hitByPitch', 'strikeout'].includes(resolvedPlay.kind)
    if (canRun) { setPending({ play: resolvedPlay, runners, current: 0, results: [] }); setPhase('running') }
    else finishPlateAppearance(resolvedPlay, [], decision)
  }

  const chooseRunning = (choice: RunChoice) => {
    if (!pending) return
    const runner = pending.runners[pending.current]
    const isMisplay = runner.event === 'outfieldMisplay' || runner.event === 'infieldMisplay'
    const advance = choice === 'hold' ? 0 : Math.max(1, pending.play.advance) + Number(choice === 'aggressive')
    const destination = runner.isBatter ? (choice === 'aggressive' ? 2 : 1) : Math.min(4, runner.base + advance)
    const successChance = runner.isBatter
      ? choice === 'aggressive' ? (isMisplay ? RUNNING_CHANCES.aggressiveOnMisplay : RUNNING_CHANCES.aggressiveOnCleanFielding) : 1
      : choice === 'hold' ? 1 : choice === 'safe' ? RUNNING_CHANCES.safeAdvance : RUNNING_CHANCES.aggressiveAdvance
    const success = Math.random() < successChance
    const note = runner.isBatter
      ? choice === 'aggressive' ? `2루 도전 ${success ? '성공' : '실패'}` : '1루 정지'
      : undefined
    const result = { base: runner.base, destination, success, isBatter: runner.isBatter, note }
    const results = [...pending.results, result]
    if (pending.current + 1 < pending.runners.length) setPending({ ...pending, current: pending.current + 1, results })
    else finishPlateAppearance(pending.play, results)
  }

  const continueGame = () => {
    if (plateAppearance === 3) { setPhase('finished'); return }
    setPlateAppearance((current) => current + 1); setSituation(randomSituation())
    setBatDecision(''); setPhase('batting')
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

  const currentRunner = pending?.runners[pending.current]
  const displayedBases: Base[] = phase === 'running' && pending?.runners.some((runner) => runner.isBatter)
    ? [1, ...situation.bases.filter((base) => base < 3).map((base) => (base + 1) as Base)]
    : situation.bases
  const displayedSituation = { ...situation, bases: displayedBases }
  return <main className="app-shell">
    <header className="brand-bar"><div><b className="brand-mark">EPS</b><span>BASEBALL SIM</span></div><button className="icon-button" type="button" onClick={resetGame} title="새 경기" aria-label="새 경기"><RotateCcw size={18} /></button></header>
    <div className="game-grid">
      <MediaStage situation={displayedSituation} plateAppearance={plateAppearance} />
      <section className="decision-panel"><div className="panel-heading"><span className="view-chip">{phase === 'running' ? `${currentRunner?.base}루 주자 시점` : '타석 시점'}</span><p>{phase === 'batting' ? '어떤 플레이를 선택하시겠습니까?' : phase === 'running' ? `${pending?.play.label} · 다음 플레이를 선택하세요.` : '플레이가 끝났습니다.'}</p></div>
        {phase === 'batting' && <div className="choices batting-choices">{BATTING_EVENTS.map((event, index) => <button type="button" onClick={() => chooseBatting(event.kind)} key={event.kind}><span className="choice-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{event.label}</strong><small>{event.description}</small></span><ChevronRight size={18} /></button>)}</div>}
        {phase === 'running' && pending && currentRunner?.isBatter && <>
          {currentRunner.event !== 'standard' && <div className="event-alert"><span>돌발 이벤트</span><strong>{currentRunner.event === 'infieldMisplay' ? '내야수가 공을 뒤로 빠뜨렸습니다!' : '외야수가 공을 뒤로 빠뜨렸습니다!'}</strong><p>수비가 공을 수습하는 사이 2루까지 노릴 수 있습니다.</p></div>}
          <div className="choices runner-choices"><button type="button" onClick={() => chooseRunning('safe')}><span className="choice-index">01</span><span><strong>안전하게 1루에 머문다</strong><small>아웃 위험 없이 플레이를 마친다</small></span><ChevronRight size={18} /></button><button type="button" onClick={() => chooseRunning('aggressive')}><span className="choice-index">02</span><span><strong>위험을 감수하고 2루로 진루한다</strong><small>{currentRunner.event !== 'standard' ? '수비 실수를 이용한다 · 성공률 80%' : '빠른 중계 플레이에 도전한다 · 성공률 35%'}</small></span><ChevronRight size={18} /></button></div>
        </>}
        {phase === 'running' && pending && currentRunner && !currentRunner.isBatter && <div className="choices">{pending.play.advance === 0 && <button type="button" onClick={() => chooseRunning('hold')}><span className="choice-index">01</span><span><strong>베이스로 귀루</strong><small>현재 베이스를 지킨다 · 성공률 100%</small></span><ChevronRight size={18} /></button>}<button type="button" onClick={() => chooseRunning('safe')}><span className="choice-index">02</span><span><strong>{pending.play.advance === 0 ? '다음 베이스로 태그업' : '기본 진루'}</strong><small>안전한 판단 · 성공률 94%</small></span><ChevronRight size={18} /></button><button type="button" onClick={() => chooseRunning('aggressive')}><span className="choice-index">03</span><span><strong>추가 베이스를 노린다</strong><small>과감한 승부 · 성공률 70%</small></span><ChevronRight size={18} /></button></div>}
        {phase === 'between' && <div className="play-result"><p className="eyebrow">PLAY COMPLETE</p><h3>{records.at(-1)?.result}</h3><p>{plateAppearance === 3 ? '모든 타석이 끝났습니다.' : '다음 타석은 새로운 상황에서 시작합니다.'}</p><button className="primary-button" type="button" onClick={continueGame}>{plateAppearance === 3 ? '결과 보기' : '다음 타석'} <ChevronRight size={18} /></button></div>}
      </section>
    </div>
    <footer className="progress-strip">{[1, 2, 3].map((item) => <div className={item < plateAppearance || phase === 'between' && item === plateAppearance ? 'complete' : item === plateAppearance ? 'active' : ''} key={item}><span>0{item}</span><i /><p>{records[item - 1]?.result ?? (item === plateAppearance ? '진행 중' : '대기')}</p></div>)}</footer>
  </main>
}

export default App
