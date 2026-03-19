import { useEffect, useState } from 'react'
import Card from '../components/Card'
import ProgressBar from '../components/ProgressBar'

const EMPTY_SUMMARY = {
    runs: 0,
    success_rate: 0,
    total_processed: 0,
    total_media: 0,
    total_ram_bypass: 0,
    total_duplicates: 0,
    total_errors: 0,
    avg_rate: 0,
}

const OPERATION_LABELS = {
    clone: 'Clonar Canal',
    restricted: 'Clone protegido (legado)',
    sync: 'Sync contínua',
    multi: 'Clone Tópicos',
    forum: 'Clone Fórum',
}

const STATUS_LABELS = {
    active: 'Ativo',
    done: 'Concluído',
    idle: 'Em espera',
    processing: 'Processando',
    queued: 'Na fila',
    running: 'Em andamento',
    starting: 'Preparando',
    stopped: 'Interrompido',
    success: 'Concluído',
}

export default function OpsCenter({ telegram }) {
    const { getDashboard, clearHistory, clearErrorSummary, progress, syncState } = telegram
    const [dashboard, setDashboard] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true

        const load = async () => {
            try {
                const data = await getDashboard()
                if (active) setDashboard(data)
            } finally {
                if (active) setLoading(false)
            }
        }

        load()
        const interval = setInterval(load, 4000)
        return () => {
            active = false
            clearInterval(interval)
        }
    }, [getDashboard])

    const activeJob = dashboard?.active_job
    const lastJob = dashboard?.last_job
    const focusJob = activeJob || lastJob
    const recentHistory = dashboard?.recent_history || []
    const errorSummary = dashboard?.error_summary || []
    const summary = { ...EMPTY_SUMMARY, ...(dashboard?.summary || {}) }
    const syncSnapshot = syncState || dashboard?.sync_state
    const currentPercent = progress?.percent || 0

    const clearHistoryState = async () => {
        await clearHistory()
        setDashboard((prev) => ({
            ...(prev || {}),
            recent_history: [],
            last_job: null,
            summary: { ...EMPTY_SUMMARY },
        }))
    }

    return (
        <div className="data-grid">
            <Card eyebrow="VISÃO GERAL" title="Central de monitoramento" description="Acompanhe volume clonado, arquivos de mídia, falhas e ritmo do aplicativo.">
                {loading ? (
                    <p style={{ color: 'var(--color-ink-muted)', fontSize: '13px' }}>Carregando visão operacional...</p>
                ) : (
                    <div className="stack-list">
                        <div className="mini-metric-grid">
                            <Metric label="Execuções" value={summary.runs} />
                            <Metric label="Sucesso" value={`${summary.success_rate}%`} />
                            <Metric label="Mensagens" value={summary.total_processed} />
                            <Metric label="Mídias" value={summary.total_media} />
                            <Metric label="RAM bypass" value={summary.total_ram_bypass} />
                            <Metric label="Duplicadas" value={summary.total_duplicates} />
                            <Metric label="Falhas" value={summary.total_errors} />
                            <Metric label="Média/min" value={summary.avg_rate} />
                        </div>

                        <div className={`status-banner ${activeJob ? 'ready' : ''}`} style={{ marginBottom: 0 }}>
                            <strong>
                                {activeJob
                                    ? `Agora: ${translateOperation(activeJob.operation)}`
                                    : lastJob
                                        ? `Última execução: ${translateOperation(lastJob.operation)}`
                                        : 'Nenhuma execução registrada'}
                            </strong>
                            <p>
                                {activeJob
                                    ? `${activeJob.source_title} -> ${activeJob.dest_title} • ${activeJob.processed ?? 0}/${activeJob.total ?? 0}`
                                    : lastJob
                                        ? `${translateStatus(lastJob.status)} • ${lastJob.source_title || lastJob.source} -> ${lastJob.dest_title || lastJob.dest}`
                                        : 'As estatísticas aparecem aqui assim que houver histórico salvo.'}
                            </p>
                        </div>

                        {activeJob && currentPercent > 0 && (
                            <ProgressBar value={currentPercent} />
                        )}

                        <p style={{ color: 'var(--color-ink-muted)', fontSize: '12px' }}>
                            Base recente: últimas 25 execuções salvas de clonagem, sync contínua e jobs legados ainda persistidos.
                        </p>
                    </div>
                )}
            </Card>

            <div className="data-grid data-grid-half">
                <Card eyebrow="AGORA" title="Fluxo atual" description="Detalhes do job ativo ou da última execução conhecida.">
                    {focusJob ? (
                        <div className="stack-list">
                            <div className="mini-metric-grid">
                                <Metric label="Estado" value={translateStatus(focusJob.status)} />
                                <Metric label="Mensagens" value={focusJob.processed ?? focusJob.cloned ?? 0} />
                                <Metric label="Escopo" value={focusJob.total ?? '-'} />
                                <Metric label="Mídias" value={focusJob.media_files ?? 0} />
                                <Metric label="RAM bypass" value={getRamBypassValue(focusJob)} />
                                <Metric label="Duplicadas" value={focusJob.skipped_duplicates ?? 0} />
                                <Metric label="Falhas" value={focusJob.errors ?? 0} />
                                <Metric label="ETA" value={focusJob.eta_label ?? '-'} />
                            </div>
                            <div className="status-banner" style={{ marginBottom: 0 }}>
                                <strong>{translateOperation(focusJob.operation)}</strong>
                                <p>{focusJob.source_title || focusJob.source} {'->'} {focusJob.dest_title || focusJob.dest}</p>
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--color-ink-muted)', fontSize: '13px' }}>Nenhum job ativo ou recente para exibir.</p>
                    )}
                </Card>

                <Card eyebrow="SYNC" title="Sync contínua" description="Replica novas mensagens em polling, sem refazer o backlog anterior.">
                    <div className="mini-metric-grid">
                        <Metric label="Estado" value={translateStatus(syncSnapshot?.status || (syncSnapshot?.active ? 'active' : 'idle'))} />
                        <Metric label="Mensagens" value={syncSnapshot?.processed ?? 0} />
                        <Metric label="Mídias" value={syncSnapshot?.media_files ?? 0} />
                        <Metric label="Duplicadas" value={syncSnapshot?.skipped_duplicates ?? 0} />
                        <Metric label="Falhas" value={syncSnapshot?.errors ?? 0} />
                        <Metric label="Polling" value={syncSnapshot?.poll_interval ? `${syncSnapshot.poll_interval}s` : '-'} />
                        <Metric label="Último ID" value={syncSnapshot?.last_seen_id ?? '-'} />
                        <Metric label="RAM bypass" value={getRamBypassValue(syncSnapshot)} />
                    </div>
                </Card>
            </div>

            <div className="data-grid data-grid-half">
                <Card
                    eyebrow="HISTÓRICO"
                    title="Execuções recentes"
                    description="Registro persistente das últimas operações concluídas ou interrompidas."
                    action={(
                        <button onClick={clearHistoryState} className="btn btn-ghost" type="button">
                            LIMPAR HISTÓRICO
                        </button>
                    )}
                >
                    {recentHistory.length ? (
                        <div className="stack-list">
                            {recentHistory.map((entry, index) => {
                                const ramBypass = getRamBypassValue(entry)

                                return (
                                    <article key={`${entry.started_at}-${index}`} className="list-card">
                                        <div>
                                            <strong>{translateOperation(entry.operation)} • {translateStatus(entry.status)}</strong>
                                            <p>{entry.source_title || entry.source} {'->'} {entry.dest_title || entry.dest}</p>
                                            <span className="mono-tag">
                                                {entry.cloned ?? 0}/{entry.total ?? 0} • mídia {entry.media_files ?? 0} • RAM {ramBypass} • erros {entry.errors ?? 0} • dup {entry.skipped_duplicates ?? 0}
                                            </span>
                                        </div>
                                        <div className="list-meta">
                                            <span>{entry.duration_seconds ?? 0}s</span>
                                            <span>{entry.messages_per_minute ? `${entry.messages_per_minute}/min` : '-'}</span>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--color-ink-muted)', fontSize: '13px' }}>Ainda não existem execuções persistidas.</p>
                    )}
                </Card>
            </div>

            <Card
                eyebrow="ERROS"
                title="Central inteligente"
                description="Agrupamento automático das falhas mais recorrentes com próxima ação sugerida."
                action={(
                    <button onClick={async () => { await clearErrorSummary(); setDashboard((prev) => ({ ...(prev || {}), error_summary: [] })) }} className="btn btn-ghost" type="button">
                        LIMPAR ERROS
                    </button>
                )}
            >
                {errorSummary.length ? (
                    <div className="stack-list">
                        {errorSummary.map((item) => (
                            <article key={item.key} className="list-card">
                                <div>
                                    <strong>{item.title}</strong>
                                    <p>{item.last_message || 'Sem mensagem detalhada.'}</p>
                                    <span className="mono-tag">Ocorrências: {item.count} • {translateOperation(item.operation)}</span>
                                </div>
                                <div className="status-banner" style={{ marginBottom: 0, minWidth: '240px' }}>
                                    <strong>Ação sugerida</strong>
                                    <p>{item.action}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <p style={{ color: 'var(--color-ink-muted)', fontSize: '13px' }}>Nenhum erro consolidado no momento.</p>
                )}
            </Card>
        </div>
    )
}

function translateOperation(operation) {
    return OPERATION_LABELS[operation] || operation || '-'
}

function translateStatus(status) {
    return STATUS_LABELS[status] || status || '-'
}

function getRamBypassValue(entry) {
    return entry?.ram_bypass_used ?? entry?.downloaded ?? 0
}

function Metric({ label, value }) {
    return (
        <div>
            <span className="kpi-val" style={{ fontSize: '22px', marginBottom: '4px' }}>{value}</span>
            <span className="kpi-lbl">{label}</span>
        </div>
    )
}
