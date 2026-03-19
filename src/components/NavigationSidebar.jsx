export default function NavigationSidebar({ activeTab, onSelect, status, tabs, user }) {
    const connected = status === 'connected'
    const pending = ['connecting', 'awaiting_code', 'awaiting_2fa'].includes(status)
    const indClass = connected ? 'on' : pending ? 'wait' : 'off'

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
