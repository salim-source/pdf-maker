package com.scanify.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.scanify.app.ui.navigation.ScanifyNavHost
import com.scanify.app.ui.theme.ScanifyTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as ScanifyApp

        setContent {
            val prefs by app.preferencesRepository.state.collectAsState()
            ScanifyTheme(themeMode = prefs.themeMode) {
                ScanifyNavHost(
                    repository = app.repository,
                    preferencesRepository = app.preferencesRepository
                )
            }
        }
    }
}
