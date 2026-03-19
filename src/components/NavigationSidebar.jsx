export default function NavigationSidebar({ activeTab, onSelect, status, tabs, user, update }) {
    const connected = status === 'connected'
    const pending = ['connecting', 'awaiting_code', 'awaiting_2fa'].includes(status)
    const indClass = connected ? 'on' : pending ? 'wait' : 'off'
    const updateCopy = getUpdateCopy(update)
    const releaseNotes = getReleaseNotesPreview(update?.releaseNotes)

    return (
        <div className="nav-shell">
            <div className="brand titlebar-nodrag">
                <span className="nav-eyebrow">Painel</span>
                <h1 className="brand-name">Haumea Clones</h1>
                <p className="brand-desc">Ferramentas de clonagem e gestão em um fluxo mais claro.</p>
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
                    <span>{connected ? 'Sessão ativa' : pending ? 'Conectando...' : 'Desconectado'}</span>
                </div>

                <div className="user-meta">
                    <strong>{user?.name ?? 'Sessão ausente'}</strong>
                    <span>{user?.username ? `@${user.username}` : 'Conecte-se à API'}</span>
                </div>

                <section className={`update-card ${update?.status || 'idle'}`}>
                    <div className="update-card-header">
                        <div>
                            <strong className="update-card-title">Atualizações</strong>
                            <p className="update-card-copy">{updateCopy.title}</p>
                        </div>
                        <span className="mono-tag">v{update?.currentVersion || '-'}</span>
                    </div>

                    <p className="update-card-copy">{updateCopy.description}</p>

                    {update?.status === 'downloading' && (
                        <div className="update-progress">
                            <div className="update-progress-fill" style={{ width: `${Math.min(update.percent || 0, 100)}%` }} />
                        </div>
                    )}

                    {update?.status === 'downloading' && (
                        <span className="update-meta">{Number(update?.percent || 0).toFixed(1)}% baixado</span>
                    )}

                    {releaseNotes && ['available', 'downloaded'].includes(update?.status) && (
                        <p className="update-notes">{releaseNotes}</p>
                    )}

                    <div className="update-actions">
                        <button
                            className="btn btn-ghost btn-compact"
                            type="button"
                            onClick={() => update?.checkForUpdates?.()}
                            disabled={!update?.supported || ['checking', 'downloading'].includes(update?.status)}
                        >
                            {update?.status === 'checking' ? 'VERIFICANDO...' : 'VERIFICAR'}
                        </button>

                        {update?.status === 'available' && (
                            <button
                                className="btn btn-primary btn-compact"
                                type="button"
                                onClick={() => update?.downloadUpdate?.()}
                            >
                                BAIXAR
                            </button>
                        )}

                        {update?.status === 'downloaded' && (
                            <button
                                className="btn btn-primary btn-compact"
                                type="button"
                                onClick={() => update?.installUpdate?.()}
                            >
                                REINICIAR
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
    switch (update?.status) {
        case 'unsupported':
            return {
                title: 'Auto-update indisponível aqui',
                description: update?.message || 'Use a versão instalada para receber atualizações automáticas.',
            }
        case 'checking':
            return {
                title: 'Procurando nova versão',
                description: 'O app está consultando o GitHub Releases agora.',
            }
        case 'available':
            return {
                title: update?.availableVersion ? `Nova versão v${update.availableVersion}` : 'Nova versão disponível',
                description: 'Você pode baixar a atualização sem reinstalar manualmente.',
            }
        case 'downloading':
            return {
                title: update?.availableVersion ? `Baixando v${update.availableVersion}` : 'Baixando atualização',
                description: 'O download acontece no próprio aplicativo.',
            }
        case 'downloaded':
            return {
                title: update?.downloadedVersion ? `v${update.downloadedVersion} pronta` : 'Atualização pronta',
                description: 'Clique em reiniciar para fechar e aplicar a nova versão.',
            }
        case 'not-available':
            return {
                title: 'Tudo em dia',
                description: update?.message || 'Nenhuma atualização encontrada no momento.',
            }
        case 'error':
            return {
                title: 'Falha no updater',
                description: update?.error || update?.message || 'Tente verificar novamente em instantes.',
            }
        default:
            return {
                title: update?.currentVersion ? `Versão atual v${update.currentVersion}` : 'Atualizações prontas',
                description: update?.message || 'Use verificar para procurar novas versões publicadas.',
            }
    }
}

function getReleaseNotesPreview(releaseNotes) {
    if (!releaseNotes) return ''
    const normalized = String(releaseNotes).trim()
    if (!normalized) return ''
    return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized
}
