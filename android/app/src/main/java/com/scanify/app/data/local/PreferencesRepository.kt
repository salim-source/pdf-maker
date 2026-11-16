package com.scanify.app.data.local

import android.content.Context
import com.scanify.app.data.model.ThemeMode
import com.scanify.app.data.model.UserPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class PreferencesRepository(context: Context) {
    private val prefs = context.getSharedPreferences("scanify_prefs", Context.MODE_PRIVATE)

    private val _state = MutableStateFlow(load())
    val state: StateFlow<UserPreferences> = _state.asStateFlow()

    private fun load(): UserPreferences {
        val themeStr = prefs.getString("theme_mode", ThemeMode.SYSTEM.name) ?: ThemeMode.SYSTEM.name
        val theme = runCatching { ThemeMode.valueOf(themeStr) }.getOrDefault(ThemeMode.SYSTEM)
        return UserPreferences(
            themeMode = theme,
            soundEnabled = prefs.getBoolean("sound_enabled", true),
            vibrationEnabled = prefs.getBoolean("vibration_enabled", true),
            confirmBeforeOpeningUrls = prefs.getBoolean("confirm_urls", true)
        )
    }

    fun setThemeMode(mode: ThemeMode) {
        prefs.edit().putString("theme_mode", mode.name).apply()
        _state.value = _state.value.copy(themeMode = mode)
    }

    fun setSoundEnabled(enabled: Boolean) {
        prefs.edit().putBoolean("sound_enabled", enabled).apply()
        _state.value = _state.value.copy(soundEnabled = enabled)
    }

    fun setVibrationEnabled(enabled: Boolean) {
        prefs.edit().putBoolean("vibration_enabled", enabled).apply()
        _state.value = _state.value.copy(vibrationEnabled = enabled)
    }

    fun setConfirmUrls(enabled: Boolean) {
        prefs.edit().putBoolean("confirm_urls", enabled).apply()
        _state.value = _state.value.copy(confirmBeforeOpeningUrls = enabled)
    }
}
