import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Modal from '../components/Modal'

export default function ApiConfig({ telegram }) {
    const {
        status, progress, connect, submitCode, submit2FA,
        autoLogin, loadConfig, saveConfig,
        loadStoredCredentials, persistCredentials,
        resetSession, sessionNotice, clearSessionNotice,
    } = telegram

    const [apiId, setApiId] = useState('')
    const [apiHash, setApiHash] = useState('')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [hideKeys, setHideKeys] = useState(false)

    const [antiFloodEnabled, setAntiFloodEnabled] = useState(true)
    const [pauseEveryMin, setPauseEveryMin] = useState('40')
    const [pauseEveryMax, setPauseEveryMax] = useState('60')
    const [pauseDurationMin, setPauseDurationMin] = useState('1.5')
    const [pauseDurationMax, setPauseDurationMax] = useState('3')
    const [dedupeEnabled, setDedupeEnabled] = useState(true)

    const [storedCredentials, setStoredCredentials] = useState(null)
    const [codeModal, setCodeModal] = useState(false)
    const [tfaModal, setTfaModal] = useState(false)
    const [resetModal, setResetModal] = useState(false)
    const [verifyCode, setVerifyCode] = useState('')
    const [tfaPassword, setTfaPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [resettingSession, setResettingSession] = useState(false)

    useEffect(() => {
        let cancelled = false

        async function refreshStoredCredentials() {
            const stored = (await loadStoredCredentials()) || null
            if (!cancelled) setStoredCredentials(stored)
            return stored
        }

        async function init() {
            const stored = await refreshStoredCredentials()
            if (!cancelled && stored?.api_id && stored?.api_hash) {
                setApiId(stored.api_id)
                setApiHash(stored.api_hash)
                if (stored.phone) setPhone(stored.phone)
                void autoLogin(stored.api_id, stored.api_hash, stored.phone, stored.session_string)
            }

            try {
                const cfg = await loadConfig()
                if (cancelled) return

                if (cfg.api_id && !stored?.api_id) setApiId(cfg.api_id)
                if (cfg.api_hash && !stored?.api_hash) setApiHash(cfg.api_hash)
                if (cfg.phone && !stored?.phone) setPhone(cfg.phone)
                if (cfg.anti_flood_enabled !== undefined) setAntiFloodEnabled(cfg.anti_flood_enabled)
                if (cfg.anti_flood_pause_every_min !== undefined) setPauseEveryMin(String(cfg.anti_flood_pause_every_min))
                if (cfg.anti_flood_pause_every_max !== undefined) setPauseEveryMax(String(cfg.anti_flood_pause_every_max))
                if (cfg.anti_flood_pause_duration_min !== undefined) setPauseDurationMin(String(cfg.anti_flood_pause_duration_min))
                if (cfg.anti_flood_pause_duration_max !== undefined) setPauseDurationMax(String(cfg.anti_flood_pause_duration_max))
                if (cfg.hide_api_settings !== undefined) setHideKeys(cfg.hide_api_settings)
                if (cfg.dedupe_enabled !== undefined) setDedupeEnabled(cfg.dedupe_enabled)

                if (!stored?.api_id && cfg.api_id && cfg.api_hash) {
                    void autoLogin(cfg.api_id, cfg.api_hash, cfg.phone, '')
                }
            } catch {
                // no-op
            }
        }

        init()
        return () => { cancelled = true }
    }, [autoLogin, loadConfig, loadStoredCredentials])

    useEffect(() => {
        if (status === 'awaiting_code') setCodeModal(true)
        if (status === 'awaiting_2fa') {
            setCodeModal(false)
            setTfaModal(true)
        }
        if (status === 'connected' || status === 'disconnected') {
            setCodeModal(false)
            setTfaModal(false)
            if (status === 'disconnected') {
                setVerifyCode('')
                setTfaPassword('')
            }
        }
    }, [status])

    const refreshStoredCredentials = async () => {
        const stored = (await loadStoredCredentials()) || null
        setStoredCredentials(stored)
        return stored
    }

    const handleConnect = async () => {
        if (!apiId || !apiHash || !phone) return
        clearSessionNotice()
        setLoading(true)
        try {
            await connect(apiId, apiHash, phone, password)
        } catch {
            // no-op
        }
        await refreshStoredCredentials()
        setLoading(false)
    }

    const buildConfigPayload = () => ({
            api_id: apiId,
            api_hash: apiHash,
            phone,
            anti_flood_enabled: antiFloodEnabled,
            anti_flood_pause_every: pauseEveryMin,
            anti_flood_pause_every_min: pauseEveryMin,
            anti_flood_pause_every_max: pauseEveryMax,
            anti_flood_pause_duration: pauseDurationMin,
            anti_flood_pause_duration_min: pauseDurationMin,
            anti_flood_pause_duration_max: pauseDurationMax,
            hide_api_settings: hideKeys,
            dedupe_enabled: dedupeEnabled,
        })

    const handleSave = async () => {
        await persistCredentials(apiId, apiHash, phone)
        await saveConfig(buildConfigPayload())
        await refreshStoredCredentials()
    }

    const handleApplyParameters = async () => {
        await saveConfig(buildConfigPayload())
    }

    const handleCodeSubmit = async () => {
        if (!verifyCode) return
        clearSessionNotice()
        setLoading(true)
        try {
            await submitCode(phone, verifyCode, password)
        } catch {
            // no-op
        }
        await refreshStoredCredentials()
        setLoading(false)
        setVerifyCode('')
    }

    const handle2FASubmit = async () => {
        if (!tfaPassword) return
        clearSessionNotice()
        setLoading(true)
        try {
            await submit2FA(tfaPassword)
        } catch {
            // no-op
        }
        await refreshStoredCredentials()
        setLoading(false)
        setTfaPassword('')
    }

    const handleResetSession = async () => {
        setResettingSession(true)
        try {
            await resetSession()
            setStoredCredentials((prev) => (prev ? { ...prev, session_string: '' } : prev))
            setPassword('')
            setVerifyCode('')
            setTfaPassword('')
            setCodeModal(false)
            setTfaModal(false)
            setResetModal(false)
        } catch {
            // no-op
        }
        setResettingSession(false)
    }

    const inputType = hideKeys ? 'password' : 'text'
    const isConnected = status === 'connected'
    const hasStoredSession = Boolean(storedCredentials?.session_string)
    const hasActiveOperation = Boolean(progress?.status && !['done', 'stopped'].includes(progress.status))
    const canResetSession =
        !loading &&
        !resettingSession &&
        status !== 'connecting' &&
        !hasActiveOperation &&
        (hasStoredSession || isConnected || status === 'awaiting_code' || status === 'awaiting_2fa')
    const sessionBannerClass = sessionNotice?.tone === 'error'
        ? 'error'
        : sessionNotice?.tone === 'ready'
            ? 'ready'
            : ''

    return (
        <div className="data-grid">
            <Card eyebrow="SESSÃO" title="Credenciais do Telegram" description="Vincule as credenciais da API com a sessão local do app.">
                <div className="form-grid">
                    {sessionNotice && (
                        <div className={`status-banner ${sessionBannerClass}`} style={{ marginBottom: 0 }}>
                            <strong>{sessionNotice.title}</strong>
                            <p>{sessionNotice.description}</p>
                        </div>
                    )}

                    <div className="toggle-item">
                        <div className="toggle-meta">
                            <strong>Ocultar chaves</strong>
                            <p>Ofusca API ID e API Hash na tela durante a configuração.</p>
                        </div>
                        <input type="checkbox" checked={hideKeys} onChange={(e) => setHideKeys(e.target.checked)} />
                    </div>

                    <div className="data-grid data-grid-half">
                        <Field label="API ID" hint="TLG">
                            <input type={inputType} value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="0000000" className="field-input" />
                        </Field>
                        <Field label="API Hash" hint="HEX">
                            <input type={inputType} value={apiHash} onChange={(e) => setApiHash(e.target.value)} placeholder="000abc..." className="field-input" />
                        </Field>
                        <Field label="Telefone" hint="DDI+DDD">
                            <input type={inputType} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5511999999999" className="field-input" />
                        </Field>
                        <Field label="Senha 2FA" hint="OPCIONAL">
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha da conta" className="field-input" />
                        </Field>
                    </div>

                    <div className="form-actions" style={{ marginTop: '24px' }}>
                        <button onClick={handleConnect} disabled={loading || isConnected} className="btn btn-primary" type="button">
                            {isConnected ? 'SESSÃO ATIVA' : loading ? 'VALIDANDO...' : 'INICIAR HANDSHAKE'}
                        </button>
                        <button onClick={handleSave} className="btn btn-ghost" type="button">
                            SALVAR CONFIGURAÇÃO
                        </button>
                        <button onClick={() => setResetModal(true)} disabled={!canResetSession} className="btn btn-danger" type="button">
                            {resettingSession ? 'REMOVENDO...' : 'LIMPAR SESSÃO'}
                        </button>
                    </div>
                </div>
            </Card>

            <Card eyebrow="LIMITES" title="Proteção local" description="Controla anti-flood e deduplicação para execuções repetidas.">
                <div className="form-grid">
                    <div className="toggle-item">
                        <div className="toggle-meta">
                            <strong>Limitar frequência</strong>
                            <p>Aplica pausas aleatórias entre lotes para reduzir o risco de FloodWait.</p>
                        </div>
                        <input type="checkbox" checked={antiFloodEnabled} onChange={(e) => setAntiFloodEnabled(e.target.checked)} />
                    </div>

                    {antiFloodEnabled && (
                        <div className="data-grid" style={{ marginTop: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                            <Field label="Frequência mínima" hint="MSGS">
                                <input type="number" min="1" value={pauseEveryMin} onChange={(e) => setPauseEveryMin(e.target.value)} className="field-input" />
                            </Field>
                            <Field label="Frequência máxima" hint="MSGS">
                                <input type="number" min="1" value={pauseEveryMax} onChange={(e) => setPauseEveryMax(e.target.value)} className="field-input" />
                            </Field>
                            <Field label="Pausa mínima (s)" hint="ESPERA">
                                <input type="number" min="0.1" step="0.1" value={pauseDurationMin} onChange={(e) => setPauseDurationMin(e.target.value)} className="field-input" />
                            </Field>
                            <Field label="Pausa máxima (s)" hint="ESPERA">
                                <input type="number" min="0.1" step="0.1" value={pauseDurationMax} onChange={(e) => setPauseDurationMax(e.target.value)} className="field-input" />
                            </Field>
                        </div>
                    )}

                    <div className="toggle-item">
                        <div className="toggle-meta">
                            <strong>Deduplicação inteligente</strong>
                            <p>Evita reenviar mensagens já processadas quando o mesmo par de chats roda novamente.</p>
                        </div>
                        <input type="checkbox" checked={dedupeEnabled} onChange={(e) => setDedupeEnabled(e.target.checked)} />
                    </div>

                    <div className="form-actions">
                        <button onClick={handleApplyParameters} className="btn btn-ghost" type="button">
                            APLICAR PARÂMETROS
                        </button>
                    </div>
                </div>
            </Card>

            <Modal open={codeModal} title="Código de verificação" onClose={() => setCodeModal(false)}>
                <p style={{ color: 'var(--color-ink-muted)', marginBottom: '16px', fontSize: '14px' }}>Insira o código enviado pelo Telegram.</p>
                <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
                    placeholder="Ex: 00000"
                    autoFocus
                    className="field-input"
                />
                <button onClick={handleCodeSubmit} disabled={loading} className="btn btn-primary" type="button" style={{ marginTop: '16px', width: '100%' }}>
                    {loading ? 'VALIDANDO...' : 'CONFIRMAR'}
                </button>
            </Modal>

            <Modal open={tfaModal} title="Senha 2FA exigida" onClose={() => setTfaModal(false)}>
                <p style={{ color: 'var(--color-ink-muted)', marginBottom: '16px', fontSize: '14px' }}>Sua conta possui verificação em duas etapas ativa.</p>
                <input
                    type="password"
                    value={tfaPassword}
                    onChange={(e) => setTfaPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handle2FASubmit()}
                    placeholder="Sua senha"
                    autoFocus
                    className="field-input"
                />
                <button onClick={handle2FASubmit} disabled={loading} className="btn btn-primary" type="button" style={{ marginTop: '16px', width: '100%' }}>
                    {loading ? 'VALIDANDO...' : 'CONFIRMAR'}
                </button>
            </Modal>

            <Modal open={resetModal} title="Limpar sessão atual?" onClose={() => !resettingSession && setResetModal(false)}>
                <p style={{ color: 'var(--color-ink-muted)', marginBottom: '16px', fontSize: '14px' }}>
                    Isso remove a sessão salva neste dispositivo e encerra o login atual. Suas credenciais da API serão mantidas.
                    Você poderá iniciar um novo login em seguida.
                </p>
                <div className="form-actions">
                    <button onClick={handleResetSession} disabled={resettingSession} className="btn btn-danger" type="button">
                        {resettingSession ? 'REMOVENDO...' : 'REMOVER SESSÃO'}
                    </button>
                    <button onClick={() => setResetModal(false)} disabled={resettingSession} className="btn btn-ghost" type="button">
                        CANCELAR
                    </button>
                </div>
            </Modal>
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
