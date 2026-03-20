export default function UpdateGate({ update }) {
    const blocking = Boolean(update?.blockingUpdateFlow)

    if (!blocking) return null

    const copy = getGateCopy(update)
    const releaseNotes = String(update?.releaseNotes || '').trim()
    const showProgress = update?.status === 'downloading'
    const percent = Math.min(Number(update?.percent || 0), 100)

    return (
        <div className="update-gate" role="dialog" aria-modal="true" aria-labelledby="update-gate-title">
            <div className="update-gate-panel titlebar-nodrag">
                <span className="update-gate-kicker">ATUALIZACAO OBRIGATORIA</span>
                <h2 id="update-gate-title" className="editorial-title update-gate-title">{copy.title}</h2>
                <p className="update-gate-copy">{copy.description}</p>

                <div className="update-gate-meta">
                    <span className="mono-tag">Atual v{update?.currentVersion || '-'}</span>
                    {(update?.availableVersion || update?.downloadedVersion) && (
                        <span className="mono-tag">Nova v{update?.downloadedVersion || update?.availableVersion}</span>
                    )}
                </div>

                {showProgress && (
                    <>
                        <div className="update-progress update-gate-progress">
                            <div className="update-progress-fill" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="update-meta">{percent.toFixed(1)}% baixado</span>
                    </>
                )}

                {releaseNotes && ['available', 'downloading', 'downloaded'].includes(update?.status) && (
                    <div className="update-gate-notes">
                        <strong>Notas da versao</strong>
                        <p>{releaseNotes}</p>
                    </div>
                )}

                <div className="update-gate-actions">
                    {update?.status === 'downloaded' && (
                        <button className="btn btn-primary" type="button" onClick={() => update?.installUpdate?.()}>
                            INSTALAR E REINICIAR
                        </button>
                    )}

                    {update?.status === 'error' && (
                        <button className="btn btn-primary" type="button" onClick={() => update?.checkForUpdates?.()}>
                            TENTAR NOVAMENTE
                        </button>
                    )}

                    {update?.status === 'available' && (
                        <button className="btn btn-primary" type="button" onClick={() => update?.downloadUpdate?.()}>
                            BAIXAR AGORA
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function getGateCopy(update) {
    switch (update?.status) {
        case 'checking':
            return {
                title: 'Verificando a versao obrigatoria',
                description: 'O app valida o GitHub Releases antes de liberar o restante da interface.',
            }
        case 'available':
            return {
                title: update?.availableVersion ? `Nova versao v${update.availableVersion} encontrada` : 'Nova versao encontrada',
                description: 'Esta atualizacao e obrigatoria. O download automatico ja foi iniciado para liberar o aplicativo.',
            }
        case 'downloading':
            return {
                title: update?.availableVersion ? `Baixando v${update.availableVersion}` : 'Baixando atualizacao obrigatoria',
                description: 'Aguarde o download terminar. O app continua bloqueado ate a nova versao ficar pronta.',
            }
        case 'downloaded':
            return {
                title: update?.downloadedVersion ? `v${update.downloadedVersion} pronta para instalar` : 'Atualizacao pronta',
                description: 'Instale e reinicie agora para continuar usando o app.',
            }
        case 'error':
            return {
                title: 'Nao foi possivel concluir a atualizacao obrigatoria',
                description: update?.error || 'Tente novamente para validar ou baixar a versao mais recente.',
            }
        default:
            return {
                title: 'Atualizacao obrigatoria em andamento',
                description: 'Estamos validando a versao mais recente antes de liberar o aplicativo.',
            }
    }
}
