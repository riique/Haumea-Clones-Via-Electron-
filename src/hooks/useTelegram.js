import { useState, useEffect, useCallback, useRef } from 'react'
import { ipc } from '../lib/ipc'

const store = window.electron?.store
const CONFIG_CACHE_KEY = 'app_config_cache'

function getNonEmptySessionString(...candidates) {
    for (const candidate of candidates) {
        if (typeof candidate !== 'string') continue
        const normalized = candidate.trim()
        if (normalized) return normalized
    }
    return undefined
}

export function useTelegram() {
    const [status, setStatus] = useState('disconnected')
    const [logs, setLogs] = useState([])
    const [progress, setProgress] = useState(null)
    const [user, setUser] = useState(null)
    const [syncState, setSyncState] = useState(null)
    const [sessionNotice, setSessionNotice] = useState(null)
    const initialized = useRef(false)
    const autoLoginAttempted = useRef(false)
    const autoLoginInFlight = useRef(false)
    const storeWriteQueue = useRef(Promise.resolve())
    const statusRef = useRef(status)
    const userRef = useRef(user)

    statusRef.current = status
    userRef.current = user

    useEffect(() => {
        if (initialized.current) return
        initialized.current = true

        ipc.start().catch(() => { })

        const unsubLog = ipc.onLog((data) => {
            setLogs((prev) => [...prev.slice(-500), data])
        })

        const unsubProgress = ipc.onProgress((data) => {
            setProgress(data)
            if (data?.type === 'sync') {
                setSyncState((prev) => ({ ...(prev || {}), ...data }))
            }
        })

        const unsubStatus = ipc.onStatus((data) => {
            setStatus(data.status)
        })

        return () => {
            unsubLog?.()
            unsubProgress?.()
            unsubStatus?.()
        }
    }, [])

    const clearLogs = useCallback(() => setLogs([]), [])
    const clearSessionNotice = useCallback(() => setSessionNotice(null), [])

    const queueStoreWrite = useCallback((worker) => {
        if (!store) return Promise.resolve(null)

        const nextJob = storeWriteQueue.current.then(worker, worker)
        storeWriteQueue.current = nextJob.catch(() => null)
        return nextJob
    }, [])

    const resetAuthState = useCallback((nextStatus = 'disconnected') => {
        setUser(null)
        setStatus(nextStatus)
    }, [])

    const loadStoredCredentials = useCallback(async () => {
        if (!store) return null
        return (await store.get('credentials')) || null
    }, [])

    const loadCachedConfig = useCallback(async () => {
        if (!store) return {}
        return (await store.get(CONFIG_CACHE_KEY)) || {}
    }, [])

    const patchStoredCredentials = useCallback((patch) => {
        if (!store) return Promise.resolve(null)

        return queueStoreWrite(async () => {
            if (typeof store.patchCredentials === 'function') {
                return (await store.patchCredentials(patch)) || null
            }

            const current = (await store.get('credentials')) || {}
            const next = { ...current, ...patch }
            await store.set('credentials', next)
            return next
        })
    }, [queueStoreWrite])

    const persistCredentials = useCallback((apiId, apiHash, phone, sessionString) => {
        const patch = { api_id: apiId, api_hash: apiHash, phone }
        const normalizedSession = getNonEmptySessionString(sessionString)
        if (normalizedSession !== undefined) patch.session_string = normalizedSession
        return patchStoredCredentials(patch)
    }, [patchStoredCredentials])

    const persistSessionString = useCallback((...candidates) => {
        const nextSession = getNonEmptySessionString(...candidates)
        if (!nextSession) return loadStoredCredentials()
        return patchStoredCredentials({ session_string: nextSession })
    }, [loadStoredCredentials, patchStoredCredentials])

    const clearStoredSession = useCallback(() => {
        if (!store) return Promise.resolve(null)

        return queueStoreWrite(async () => {
            if (typeof store.clearSession === 'function') {
                return (await store.clearSession()) || null
            }

            const current = (await store.get('credentials')) || {}
            const next = { ...current, session_string: '' }
            await store.set('credentials', next)
            return next
        })
    }, [queueStoreWrite])

    const connect = useCallback(async (apiId, apiHash, phone, password, options = {}) => {
        autoLoginAttempted.current = true
        clearSessionNotice()
        setStatus('connecting')

        try {
            const stored = await loadStoredCredentials()
            const sessionString = options.forceFresh ? '' : (options.sessionString ?? stored?.session_string ?? '')
            const res = await ipc.send('connect', {
                api_id: apiId,
                api_hash: apiHash,
                phone,
                password,
                session_string: sessionString,
            })

            if (res.needs_code) {
                await persistCredentials(apiId, apiHash, phone)
                if (res.reset_session) {
                    await clearStoredSession()
                }
                if (res.reset_session || res.cleared_local_session) {
                    setSessionNotice({
                        tone: 'warning',
                        title: 'A sessão salva ficou inválida',
                        description: 'A sessão local foi saneada. Confirme o código para concluir um novo login.',
                    })
                }
                resetAuthState('awaiting_code')
            } else if (res.user) {
                await persistCredentials(
                    apiId,
                    apiHash,
                    phone,
                    getNonEmptySessionString(res.session_string, sessionString, stored?.session_string),
                )
                setUser(res.user)
                setStatus('connected')
            } else {
                resetAuthState()
            }

            return res
        } catch (e) {
            resetAuthState()
            throw e
        }
    }, [clearSessionNotice, clearStoredSession, loadStoredCredentials, persistCredentials, resetAuthState])

    const submitCode = useCallback(async (phone, code, password) => {
        clearSessionNotice()

        try {
            const res = await ipc.send('submit_code', { phone, code, password })
            if (res.needs_2fa) {
                resetAuthState('awaiting_2fa')
            } else if (res.user) {
                await persistSessionString(res.session_string)
                setUser(res.user)
                setStatus('connected')
            }
            return res
        } catch (e) {
            resetAuthState()
            throw e
        }
    }, [clearSessionNotice, persistSessionString, resetAuthState])

    const submit2FA = useCallback(async (password) => {
        clearSessionNotice()

        try {
            const res = await ipc.send('submit_2fa', { password })
            if (res.user) {
                await persistSessionString(res.session_string)
                setUser(res.user)
                setStatus('connected')
            }
            return res
        } catch (e) {
            resetAuthState()
            throw e
        }
    }, [clearSessionNotice, persistSessionString, resetAuthState])

    const autoLogin = useCallback(async (apiId, apiHash, phone = '', sessionString) => {
        if (
            autoLoginAttempted.current ||
            autoLoginInFlight.current ||
            statusRef.current === 'connected' ||
            userRef.current
        ) {
            return { ok: false, skipped: true }
        }

        autoLoginInFlight.current = true
        setStatus('connecting')

        try {
            const stored = await loadStoredCredentials()
            const resolvedPhone = phone || stored?.phone || ''
            const persistedSession = sessionString ?? stored?.session_string ?? ''
            const res = await ipc.send('auto_login', {
                api_id: apiId,
                api_hash: apiHash,
                session_string: persistedSession,
            })

            if (res.ok && res.user) {
                await persistCredentials(
                    apiId,
                    apiHash,
                    resolvedPhone,
                    getNonEmptySessionString(res.session_string, persistedSession, stored?.session_string),
                )
                setUser(res.user)
                setStatus('connected')
                clearSessionNotice()
                autoLoginAttempted.current = true
                return res
            }

            if (res?.reset_session) {
                await clearStoredSession()
            }
            if (res?.reset_session || res?.cleared_local_session) {
                setSessionNotice({
                    tone: 'warning',
                    title: 'A sessão salva ficou inválida',
                    description: 'Limpe a sessão local e faça um novo login se o handshake não abrir sozinho.',
                })
            }
            if (res?.needs_reauth && resolvedPhone) {
                autoLoginAttempted.current = true
                return await connect(apiId, apiHash, resolvedPhone, '', { forceFresh: true, sessionString: '' })
            }

            resetAuthState()
            autoLoginAttempted.current = Boolean(res?.needs_reauth) || res?.error === 'No stored session'
            return res
        } catch {
            resetAuthState()
            autoLoginAttempted.current = false
            return { ok: false }
        } finally {
            autoLoginInFlight.current = false
        }
    }, [clearSessionNotice, clearStoredSession, connect, loadStoredCredentials, persistCredentials, resetAuthState])

    const resetSession = useCallback(async () => {
        setSessionNotice({
            tone: 'warning',
            title: 'Removendo sessão local...',
            description: 'Encerrando o login atual e limpando a sessão salva neste dispositivo.',
        })

        try {
            await ipc.send('clear_session')
            await clearStoredSession()
            autoLoginAttempted.current = false
            autoLoginInFlight.current = false
            resetAuthState()
            setSessionNotice({
                tone: 'ready',
                title: 'Sessão local removida',
                description: 'Inicie um novo handshake para entrar novamente.',
            })
            return { ok: true }
        } catch (e) {
            const rawMessage = String(e?.message || '')
            const backendOutdated = rawMessage.includes('Unknown method: clear_session')
            setSessionNotice({
                tone: 'error',
                title: backendOutdated ? 'Backend do instalador está desatualizado' : 'Não foi possível limpar a sessão agora',
                description: backendOutdated
                    ? 'Gere o instalador novamente com o backend atualizado. O build antigo incluiu um haumea-backend.exe sem suporte à limpeza de sessão.'
                    : 'Feche operações em andamento e tente novamente.',
            })
            throw e
        }
    }, [clearStoredSession, resetAuthState])

    const clone = useCallback((params) => ipc.send('clone', params), [])
    const multiClone = useCallback((params) => ipc.send('multi_clone', params), [])
    const forumClone = useCallback((params) => ipc.send('forum_clone', params), [])
    const stopClone = useCallback(() => ipc.send('stop'), [])

    const loadConfig = useCallback(async () => {
        const cached = await loadCachedConfig()

        try {
            const remote = (await ipc.send('load_config')) || {}
            const merged = { ...remote, ...cached }

            if (store) {
                await queueStoreWrite(async () => {
                    await store.set(CONFIG_CACHE_KEY, merged)
                    return merged
                })
            }

            return merged
        } catch {
            return cached
        }
    }, [loadCachedConfig, queueStoreWrite])

    const saveConfig = useCallback(async (config) => {
        const nextConfig = await queueStoreWrite(async () => {
            if (!store) return config || {}

            const current = (await store.get(CONFIG_CACHE_KEY)) || {}
            const merged = { ...current, ...(config || {}) }
            await store.set(CONFIG_CACHE_KEY, merged)
            return merged
        })

        return ipc.send('save_config', { config: nextConfig || config })
    }, [queueStoreWrite])
    const getSavedProgress = useCallback(() => ipc.send('get_saved_progress'), [])
    const deleteProgress = useCallback((filePath) => ipc.send('delete_progress', { file_path: filePath }), [])
    const dryRun = useCallback((params) => ipc.send('dry_run', params), [])
    const getHistory = useCallback((limit = 40) => ipc.send('get_history', { limit }), [])
    const clearHistory = useCallback(() => ipc.send('clear_history'), [])
    const getErrorSummary = useCallback(() => ipc.send('get_error_summary'), [])
    const clearErrorSummary = useCallback(() => ipc.send('clear_error_summary'), [])
    const getDashboard = useCallback(() => ipc.send('get_dashboard'), [])
    const startLiveSync = useCallback((params) => ipc.send('start_live_sync', params), [])
    const stopLiveSync = useCallback(() => ipc.send('stop_live_sync'), [])

    return {
        status, logs, progress, user, syncState, sessionNotice,
        connect, submitCode, submit2FA, autoLogin, resetSession,
        clone, multiClone, forumClone,
        stopClone,
        loadConfig, saveConfig,
        getSavedProgress, deleteProgress,
        dryRun,
        getHistory, clearHistory,
        getErrorSummary, clearErrorSummary,
        getDashboard,
        startLiveSync, stopLiveSync,
        clearLogs,
        clearSessionNotice,
        loadStoredCredentials, persistCredentials,
    }
}
