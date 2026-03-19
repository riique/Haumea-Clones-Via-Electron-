import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import ProgressBar from '../components/ProgressBar'
import { resolveAntiFloodConfig } from '../lib/antiFlood'

export default function ChannelClone({ telegram }) {
    const {
        status,
        clone,
        stopClone,
        progress,
        syncState,
        loadConfig,
        getSavedProgress,
        deleteProgress,
        dryRun,
        startLiveSync,
        stopLiveSync,
    } = telegram

    const [source, setSource] = useState('')
    const [dest, setDest] = useState('')
    const [limit, setLimit] = useState('0')
    const [delay, setDelay] = useState('0.1')
    const [syncPoll, setSyncPoll] = useState('15')
    const [running, setRunning] = useState(false)
    const [savedProgress, setSavedProgress] = useState([])
    const [dryRunResult, setDryRunResult] = useState(null)
    const [dryRunLoading, setDryRunLoading] = useState(false)

    const connected = status === 'connected'
    const cloneProgress = progress?.type === 'clone' ? progress : null
    const pct = cloneProgress?.percent || 0
    const isDone = cloneProgress?.status === 'done' || cloneProgress?.status === 'stopped'
    const syncActive = !!syncState && !['stopped', undefined, null].includes(syncState.status)

    useEffect(() => {
        if (isDone) setRunning(false)
    }, [isDone])

    useEffect(() => {
        async function init() {
            try {
                const cfg = await loadConfig()
                if (cfg.source) setSource(cfg.source)
                if (cfg.dest) setDest(cfg.dest)
                if (cfg.delay) setDelay(String(cfg.delay))
                if (cfg.limit !== undefined) setLimit(String(cfg.limit))
            } catch {
                // no-op
            }
            refreshSavedProgress()
        }
        init()
    }, [loadConfig])

    const refreshSavedProgress = async () => {
        try {
            const res = await getSavedProgress()
            setSavedProgress(res?.progress_files || [])
        } catch {
            setSavedProgress([])
        }
    }

    const matchingProgress = useMemo(() => {
        if (!source && !dest) return savedProgress
        return savedProgress.filter((item) => {
            const sourceMatch = !source || item.source === source
            const destMatch = !dest || item.dest === dest
            return sourceMatch && destMatch
        })
    }, [dest, savedProgress, source])

    const handleStart = async (resumeFrom = null, nextSource = source, nextDest = dest) => {
        if (!nextSource || !nextDest) return
        setRunning(true)
        try {
            const config = await loadConfig().catch(() => ({}))
            const antiFlood = resolveAntiFloodConfig(config)
            await clone({
                source: nextSource,
                dest: nextDest,
                limit: parseInt(limit, 10) || 0,
                delay: parseFloat(delay) || 0.1,
                resume_from_msg_id: resumeFrom,
                ...antiFlood,
            })
            await refreshSavedProgress()
        } catch {
            setRunning(false)
        }
    }

    const handleDryRun = async () => {
        if (!source || !dest) return
        setDryRunLoading(true)
        try {
            const res = await dryRun({
                source,
                dest,
                limit: parseInt(limit, 10) || 0,
                mode: 'clone',
            })
            setDryRunResult(res)
        } finally {
            setDryRunLoading(false)
        }
    }

    const handleRemoveProgress = async (filePath) => {
        await deleteProgress(filePath)
        await refreshSavedProgress()
    }

    const handleStartSync = async () => {
        if (!source || !dest) return
        const config = await loadConfig().catch(() => ({}))
        const antiFlood = resolveAntiFloodConfig(config)
        await startLiveSync({
            source,
            dest,
            poll_interval: parseInt(syncPoll, 10) || 15,
            delay: parseFloat(delay) || 0.1,
            ...antiFlood,
        })
    }

    const handleStopSync = async () => {
        await stopLiveSync()
    }

    return (
        <div className="data-grid">
            <Card eyebrow="SETUP" title="Origem, destino e sync" description="Rode o clone principal, retome jobs interrompidos e acompanhe o modo contínuo.">
                <div className="form-grid">
                    <Field label="Canal de origem" hint="URL ou ID">
                        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="@origem ou t.me/grupo/25964" className="field-input" disabled={running} />
                    </Field>

                    <Field label="Canal de destino" hint="URL ou ID">
                        <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="@destino ou t.me/grupo/25964" className="field-input" disabled={running} />
                    </Field>

                    <div className="data-grid data-grid-half">
                        <Field label="Limite" hint="0 = TODAS">
                            <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} className="field-input" disabled={running} />
                        </Field>
                        <Field label="Delay" hint="SEGUNDOS">
                            <input type="number" step="0.1" value={delay} onChange={(e) => setDelay(e.target.value)} className="field-input" disabled={running} />
                        </Field>
                    </div>

                    <div className="data-grid data-grid-half">
                        <Field label="Polling da sync" hint="SEGUNDOS">
                            <input type="number" min="5" value={syncPoll} onChange={(e) => setSyncPoll(e.target.value)} className="field-input" />
                        </Field>
                        <div className="status-banner ready" style={{ marginBottom: 0 }}>
                            <strong>{syncActive ? 'Sync contínua ativa' : 'Sync contínua inativa'}</strong>
                            <p>
                                {syncActive
                                    ? `Processadas: ${syncState?.processed ?? 0} • Duplicadas: ${syncState?.skipped_duplicates ?? 0}`
                                    : 'Acompanha apenas mensagens novas a partir do momento em que a sync é iniciada.'}
                            </p>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button onClick={() => handleStart(null)} disabled={!connected || running || !source || !dest} className="btn btn-primary" type="button">
                            {running ? 'EXECUTANDO...' : 'INICIAR PROCESSO'}
                        </button>
                        <button onClick={handleDryRun} disabled={!connected || !source || !dest || dryRunLoading} className="btn btn-ghost" type="button">
                            {dryRunLoading ? 'ANALISANDO...' : 'ANÁLISE PRÉVIA'}
                        </button>
                        {syncActive ? (
                            <button onClick={handleStopSync} className="btn btn-danger" type="button">
                                PARAR SYNC
                            </button>
                        ) : (
                            <button onClick={handleStartSync} disabled={!connected || !source || !dest} className="btn btn-ghost" type="button">
                                INICIAR SYNC
                            </button>
                        )}
                        {running && (
                            <button onClick={() => { stopClone(); setRunning(false) }} className="btn btn-danger" type="button">
                                INTERROMPER
                            </button>
                        )}
                    </div>
                </div>
            </Card>

            <div className="data-grid data-grid-half">
                <Card eyebrow="RETOMADA" title="Jobs salvos" description="Arquivos de progresso para continuar do último checkpoint consistente.">
                    {matchingProgress.length ? (
                        <div className="stack-list">
                            {matchingProgress.map((item) => (
                                <article key={item._file} className="list-card">
                                    <div>
                                        <strong>{item.source_title || item.source}</strong>
                                        <p>{item.dest_title || item.dest}</p>
                                        <span className="mono-tag">Msg #{item.last_message_id} • {item.cloned}/{item.total}</span>
                                    </div>
                                    <div className="inline-actions">
                                        <button
                                            className="btn btn-primary"
                                            type="button"
                                            disabled={!connected || running}
                                            onClick={() => {
                                                setSource(item.source)
                                                setDest(item.dest)
                                                handleStart(item.last_message_id, item.source, item.dest)
                                            }}
                                        >
                                            RETOMAR
                                        </button>
                                        <button className="btn btn-ghost" type="button" onClick={() => handleRemoveProgress(item._file)}>
                                            EXCLUIR
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--color-ink-muted)', fontSize: '13px' }}>Nenhum checkpoint salvo para retomar agora.</p>
                    )}
                </Card>

                <Card eyebrow="PRE-FLIGHT" title="Análise prévia" description="Estimativa rápida antes de consumir sessão e banda.">
                    {dryRunResult ? (
                        <div className="stack-list">
                            <div className="mini-metric-grid">
                                <Metric label="Mensagens" value={dryRunResult.total_messages} />
                                <Metric label="Mídias" value={dryRunResult.media_messages} />
                                <Metric label="Volume" value={dryRunResult.estimated_size} />
                                <Metric label="Duplicadas" value={dryRunResult.known_duplicates} />
                            </div>
                            {dryRunResult.resumable && (
                                <div className="status-banner ready" style={{ marginBottom: 0 }}>
                                    <strong>Progresso salvo encontrado</strong>
                                    <p>Último checkpoint em #{dryRunResult.saved_progress?.last_message_id}.</p>
                                </div>
                            )}
                            {dryRunResult.warnings?.length > 0 && (
                                <div className="stack-list">
                                    {dryRunResult.warnings.map((warning) => (
                                        <div key={warning} className="status-banner" style={{ marginBottom: 0 }}>
                                            <strong>Atenção</strong>
                                            <p>{warning}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--color-ink-muted)', fontSize: '13px' }}>Rode uma análise prévia para ver contagem, volume estimado e sinais de retomada.</p>
                    )}
                </Card>
            </div>

            <Card eyebrow="TELEMETRIA" title="Monitoramento" description="Progresso em tempo real com throughput, ETA, duplicações evitadas e bypass RAM automático.">
                {running || isDone || pct > 0 ? (
                    <>
                        <ProgressBar value={pct} />
                        <div className="kpi-row">
                            <Metric label="Processadas" value={cloneProgress?.cloned ?? 0} />
                            <Metric label="Escopo" value={cloneProgress?.total ?? '-'} />
                            <Metric label="Bypass RAM" value={cloneProgress?.ram_bypass_used ?? 0} />
                            <Metric label="Duplicadas" value={cloneProgress?.skipped_duplicates ?? 0} />
                            <Metric label="Velocidade" value={cloneProgress?.messages_per_minute ? `${cloneProgress.messages_per_minute}/min` : '-'} />
                            <Metric label="ETA" value={cloneProgress?.eta_label ?? '-'} />
                        </div>
                    </>
                ) : (
                    <div className={`status-banner ${connected ? 'ready' : ''}`}>
                        <strong>{connected ? 'Sistema preparado' : 'Aguardando conexão'}</strong>
                        <p>{connected ? 'Preencha os canais e use análise prévia, Clonar Canal ou sync contínua.' : 'Conecte-se à API para liberar operações.'}</p>
                    </div>
                )}
            </Card>
        </div>
    )
}

function Field({ label, hint, children }) {
    return (
        <div className="field-group">
            <label>
                {label}
                {hint && <span className="field-hint">{hint}</span>}
            </label>
            {children}
        </div>
    )
}

function Metric({ label, value }) {
    return (
        <div>
            <span className="kpi-val" style={{ fontSize: '22px', marginBottom: '4px' }}>{value}</span>
            <span className="kpi-lbl">{label}</span>
        </div>
    )
}
