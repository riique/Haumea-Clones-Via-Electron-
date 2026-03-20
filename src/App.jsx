import { useState } from 'react'
import NavigationSidebar from './components/NavigationSidebar'
import Sidebar from './components/Sidebar'
import UpdateGate from './components/UpdateGate'
import WindowDragStrip from './components/WindowDragStrip'
import ApiConfig from './pages/ApiConfig'
import ChannelClone from './pages/ChannelClone'
import MultiGroup from './pages/MultiGroup'
import ForumClone from './pages/ForumClone'
import OpsCenter from './pages/OpsCenter'
import { useAppUpdate } from './hooks/useAppUpdate'
import { useTelegram } from './hooks/useTelegram'

const TABS = [
    { id: 'config', label: 'Configuracao', short: 'API', description: 'Credenciais, sessao local e parametros globais.' },
    { id: 'clone', label: 'Clonar Canal', short: 'CC', description: 'Fluxo principal com retomada, analise previa e bypass automatico para conteudo protegido.' },
    { id: 'multi', label: 'Clone Topicos', short: 'CT', description: 'Distribui grupos em topicos de destino com tratamento automatico de midia protegida.' },
    { id: 'forum', label: 'Clone Forum', short: 'CF', description: 'Replica topicos e mensagens com bypass RAM transparente quando necessario.' },
    { id: 'ops', label: 'Monitoramento', short: 'MN', description: 'Indicadores de clonagem, midia, erros, historico e sync continua.' },
]

export default function App() {
    const [activeTab, setActiveTab] = useState('config')
    const telegram = useTelegram()
    const update = useAppUpdate()

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
        <>
            <div className="app-layout" aria-hidden={update.blockingUpdateFlow}>
                <aside className="layout-col layout-nav">
                    <NavigationSidebar
                        activeTab={activeTab}
                        onSelect={setActiveTab}
                        status={telegram.status}
                        tabs={TABS}
                        user={telegram.user}
                        update={update}
                    />
                </aside>

                <main className="layout-col layout-main">
                    <WindowDragStrip />
                    <section className="main-content titlebar-nodrag">
                        <header className="content-header">
                            <span className="kicker">MODULO</span>
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

            <UpdateGate update={update} />
        </>
    )
}
