import { useState } from 'react'
import NavigationSidebar from './components/NavigationSidebar'
import Sidebar from './components/Sidebar'
import WindowDragStrip from './components/WindowDragStrip'
import ApiConfig from './pages/ApiConfig'
import ChannelClone from './pages/ChannelClone'
import MultiGroup from './pages/MultiGroup'
import ForumClone from './pages/ForumClone'
import OpsCenter from './pages/OpsCenter'
import { useTelegram } from './hooks/useTelegram'

const TABS = [
    { id: 'config', label: 'Configuração', short: 'API', description: 'Credenciais, sessão local e parâmetros globais.' },
    { id: 'clone', label: 'Clonar Canal', short: 'CC', description: 'Fluxo principal com retomada, análise prévia e bypass automático para conteúdo protegido.' },
    { id: 'multi', label: 'Clone Tópicos', short: 'CT', description: 'Distribui grupos em tópicos de destino com tratamento automático de mídia protegida.' },
    { id: 'forum', label: 'Clone Fórum', short: 'CF', description: 'Replica tópicos e mensagens com bypass RAM transparente quando necessário.' },
    { id: 'ops', label: 'Monitoramento', short: 'MN', description: 'Indicadores de clonagem, mídia, erros, histórico e sync contínua.' },
]

export default function App() {
    const [activeTab, setActiveTab] = useState('config')
    const telegram = useTelegram()

    const renderPage = () => {
        switch (activeTab) {
            case 'config': return <ApiConfig telegram={telegram} />
            case 'clone': return <ChannelClone telegram={telegram} />
            case 'multi': return <MultiGroup telegram={telegram} />
            case 'forum': return <ForumClone telegram={telegram} />
            case 'ops': return <OpsCenter telegram={telegram} />
            default: return null
        }
    }

    const activeView = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]

    return (
        <div className="app-layout">
            <aside className="layout-col layout-nav">
                <NavigationSidebar
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                    status={telegram.status}
                    tabs={TABS}
                    user={telegram.user}
                />
            </aside>

            <main className="layout-col layout-main">
                <WindowDragStrip />
                <section className="main-content titlebar-nodrag">
                    <header className="content-header">
                        <span className="kicker">MÓDULO</span>
                        <h2 className="editorial-title">{activeView.label}</h2>
                        <p>{activeView.description}</p>
                    </header>
                    {renderPage()}
                </section>
            </main>

            <aside className="layout-col layout-log">
                <WindowDragStrip />
                <Sidebar logs={telegram.logs} onClear={telegram.clearLogs} />
            </aside>
        </div>
    )
}
