package com.scanify.app

import android.app.Application
import com.scanify.app.data.local.PreferencesRepository
import com.scanify.app.data.local.ScanifyDatabase
import com.scanify.app.data.repository.ScanifyRepository

class ScanifyApp : Application() {
    val database: ScanifyDatabase by lazy { ScanifyDatabase.getInstance(this) }
    val preferencesRepository: PreferencesRepository by lazy { PreferencesRepository(this) }
    val repository: ScanifyRepository by lazy { ScanifyRepository(this, database.scanifyDao()) }
}
