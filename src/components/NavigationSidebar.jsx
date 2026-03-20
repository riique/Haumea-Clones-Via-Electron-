export default function NavigationSidebar({ activeTab, onSelect, status, tabs, user, update }) {
    const connected = status === 'connected'
    const pending = ['connecting', 'awaiting_code', 'awaiting_2fa'].includes(status)
    const indClass = connected ? 'on' : pending ? 'wait' : 'off'
    const updateCopy = getUpdateCopy(update)
    const releaseNotes = getReleaseNotesPreview(update?.releaseNotes)
    const blockingUpdateFlow = Boolean(update?.blockingUpdateFlow)

    return (
        <div className="nav-shell">
            <div className="brand titlebar-nodrag">
                <span className="nav-eyebrow">Painel</span>
                <h1 className="brand-name">Haumea Clones</h1>
                <p className="brand-desc">Ferramentas de clonagem e gestao em um fluxo mais claro.</p>
            </div>

            <div className="nav-scroll titlebar-nodrag">
                <nav className="nav-menu">
                    {tabs.map((tab) => {
                        const active = tab.id === activeTab
                        return (
                            <button
                                key={tab.id}
                                className={`nav-link ${active ? 'active' : ''}`}
                                onClick={() => onSelect(tab.id)}
                                type="button"
                            >
                                <span className="nav-icon">{tab.short}</span>
                                <span className="nav-copy">
                                    <span className="nav-label">{tab.label}</span>
                                </span>
                            </button>
                        )
                    })}
                </nav>
            </div>

            <footer className="nav-footer titlebar-nodrag">
                <div className="status-pill">
                    <span className={`indicator ${indClass}`} />
                    <span>{connected ? 'Sessao ativa' : pending ? 'Conectando...' : 'Desconectado'}</span>
                </div>

                <div className="user-meta">
                    <strong>{user?.name ?? 'Sessao ausente'}</strong>
                    <span>{user?.username ? `@${user.username}` : 'Conecte-se a API'}</span>
                </div>

                <section className={`update-card ${update?.status || 'idle'} ${blockingUpdateFlow ? 'required' : ''}`}>
                    <div className="update-card-header">
                        <div>
                            <strong className="update-card-title">Atualizacoes</strong>
                            <p className="update-card-copy">{updateCopy.title}</p>
                        </div>
                        <span className="mono-tag">v{update?.currentVersion || '-'}</span>
                    </div>

                    <p className="update-card-copy">{updateCopy.description}</p>

                    {showBlockingFlag(blockingUpdateFlow) && (
                        <span className="update-required-flag">Fluxo obrigatorio</span>
                    )}

                    {update?.status === 'downloading' && (
                        <div className="update-progress">
                            <div className="update-progress-fill" style={{ width: `${Math.min(update.percent || 0, 100)}%` }} />
                        </div>
                    )}

                    {update?.status === 'downloading' && (
                        <span className="update-meta">{Number(update?.percent || 0).toFixed(1)}% baixado</span>
                    )}

                    {releaseNotes && ['available', 'downloaded', 'downloading'].includes(update?.status) && (
                        <p className="update-notes">{releaseNotes}</p>
                    )}

                    <div className="update-actions">
                        {!blockingUpdateFlow && (
                            <button
                                className="btn btn-ghost btn-compact"
                                type="button"
                                onClick={() => update?.checkForUpdates?.()}
                                disabled={!update?.supported || ['checking', 'downloading'].includes(update?.status)}
                            >
                                {update?.status === 'checking' ? 'VERIFICANDO...' : 'VERIFICAR'}
                            </button>
                        )}

                        {update?.status === 'available' && (
                            <button
                                className="btn btn-primary btn-compact"
                                type="button"
                                onClick={() => update?.downloadUpdate?.()}
                            >
                                {blockingUpdateFlow ? 'BAIXAR AGORA' : 'BAIXAR'}
                            </button>
                        )}

                        {update?.status === 'downloaded' && (
                            <button
                                className="btn btn-primary btn-compact"
                                type="button"
                                onClick={() => update?.installUpdate?.()}
                            >
                                {blockingUpdateFlow ? 'INSTALAR' : 'REINICIAR'}
                            </button>
                        )}

                        {update?.status === 'error' && blockingUpdateFlow && (
                            <button
                                className="btn btn-primary btn-compact"
                                type="button"
                                onClick={() => update?.checkForUpdates?.()}
                            >
                                TENTAR DE NOVO
                            </button>
                        )}
                    </div>
                </section>

                <div className="sidebar-credit">
                    <span>Criado por </span>
                    <a href="https://x.com/riiquestudies" target="_blank" rel="noreferrer">
                        @riiquestudies
                    </a>
                </div>
            </footer>
        </div>
    )
}

function getUpdateCopy(update) {
    const blockingUpdateFlow = Boolean(update?.blockingUpdateFlow)

    switch (update?.status) {
        case 'unsupported':
            return {
                title: 'Auto-update indisponivel aqui',
                description: update?.message || 'Use a versao instalada para receber atualizacoes automaticas.',
            }
        case 'checking':
            return {
                title: blockingUpdateFlow ? 'Validando versao obrigatoria' : 'Procurando nova versao',
                description: blockingUpdateFlow
                    ? 'A abertura do app depende dessa verificacao automatica.'
                    : 'O app esta consultando o GitHub Releases agora.',
            }
        case 'available':
            return {
                title: update?.availableVersion ? `Nova versao v${update.availableVersion}` : 'Nova versao disponivel',
                description: blockingUpdateFlow
                    ? 'Essa atualizacao e obrigatoria e o download automatico ja foi iniciado.'
                    : 'Voce pode baixar a atualizacao sem reinstalar manualmente.',
            }
        case 'downloading':
            return {
                title: update?.availableVersion ? `Baixando v${update.availableVersion}` : 'Baixando atualizacao',
                description: blockingUpdateFlow
                    ? 'O app fica bloqueado ate o pacote obrigatorio terminar de baixar.'
                    : 'O download acontece no proprio aplicativo.',
            }
        case 'downloaded':
            return {
                title: update?.downloadedVersion ? `v${update.downloadedVersion} pronta` : 'Atualizacao pronta',
                description: blockingUpdateFlow
                    ? 'Instale e reinicie para liberar o restante do app.'
                    : 'Clique em reiniciar para fechar e aplicar a nova versao.',
            }
        case 'not-available':
            return {
                title: 'Tudo em dia',
                description: update?.message || 'Nenhuma atualizacao encontrada no momento.',
            }
        case 'error':
            return {
                title: blockingUpdateFlow ? 'Atualizacao obrigatoria pendente' : 'Falha no updater',
                description: blockingUpdateFlow
                    ? update?.error || 'Tente novamente para validar a versao mais recente.'
                    : update?.error || update?.message || 'Tente verificar novamente em instantes.',
            }
        default:
            return {
                title: update?.currentVersion ? `Versao atual v${update.currentVersion}` : 'Atualizacoes prontas',
                description: update?.message || 'O app verifica atualizacoes automaticamente ao abrir.',
            }
    }
}

function getReleaseNotesPreview(releaseNotes) {
    if (!releaseNotes) return ''
    const normalized = String(releaseNotes).trim()
    if (!normalized) return ''
    return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized
}

function showBlockingFlag(blockingUpdateFlow) {
    return blockingUpdateFlow
}
