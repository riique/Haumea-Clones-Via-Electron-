function toPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function toPositiveFloat(value, fallback) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function resolveAntiFloodConfig(config = {}) {
    const enabled = config.anti_flood_enabled !== false
    const legacyEvery = toPositiveInt(config.anti_flood_pause_every, 50)
    const everyMin = toPositiveInt(config.anti_flood_pause_every_min, legacyEvery)
    const everyMax = toPositiveInt(config.anti_flood_pause_every_max, legacyEvery)
    const lowerEvery = Math.min(everyMin, everyMax)
    const upperEvery = Math.max(everyMin, everyMax)
    const legacyPauseDuration = toPositiveFloat(config.anti_flood_pause_duration, 2)
    const durationMin = toPositiveFloat(config.anti_flood_pause_duration_min, legacyPauseDuration)
    const durationMax = toPositiveFloat(config.anti_flood_pause_duration_max, legacyPauseDuration)
    const lowerDuration = Math.min(durationMin, durationMax)
    const upperDuration = Math.max(durationMin, durationMax)

    return {
        pause_every: enabled ? lowerEvery : 0,
        pause_every_min: enabled ? lowerEvery : 0,
        pause_every_max: enabled ? upperEvery : 0,
        pause_duration: enabled ? lowerDuration : 0,
        pause_duration_min: enabled ? lowerDuration : 0,
        pause_duration_max: enabled ? upperDuration : 0,
    }
}
