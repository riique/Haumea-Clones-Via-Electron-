import { useCallback, useEffect, useState } from 'react'

const updater = window.electron?.updater

const INITIAL_STATE = {
    supported: false,
    status: 'idle',
    currentVersion: '',
    availableVersion: '',
    downloadedVersion: '',
    percent: 0,
    transferred: 0,
    total: 0,
    message: '',
    error: '',
    checkedAt: null,
    releaseNotes: '',
}

export function useAppUpdate() {
    const [state, setState] = useState(INITIAL_STATE)

    useEffect(() => {
        let active = true

        const loadState = async () => {
            try {
                const nextState = await updater?.getState?.()
                if (active && nextState) {
                    setState((prev) => ({ ...prev, ...nextState }))
                }
            } catch {
                // no-op
            }
        }

        loadState()
        const unsubscribe = updater?.onState?.((nextState) => {
            if (!active || !nextState) return
            setState((prev) => ({ ...prev, ...nextState }))
        }) ?? (() => {})

        return () => {
            active = false
            unsubscribe?.()
        }
    }, [])

    const checkForUpdates = useCallback(() => {
        return updater?.check?.() ?? Promise.resolve({ ok: false, error: 'Updater indisponível.' })
    }, [])

    const downloadUpdate = useCallback(() => {
        return updater?.download?.() ?? Promise.resolve({ ok: false, error: 'Updater indisponível.' })
    }, [])

    const installUpdate = useCallback(() => {
        return updater?.install?.() ?? Promise.resolve({ ok: false, error: 'Updater indisponível.' })
    }, [])

    return {
        ...state,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
    }
}
