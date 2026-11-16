package com.scanify.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.scanify.app.data.model.GeneratedQrEntity
import com.scanify.app.data.model.PdfDocumentEntity
import com.scanify.app.data.model.ScanHistoryEntity

@Database(
    entities = [
        PdfDocumentEntity::class,
        ScanHistoryEntity::class,
        GeneratedQrEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class ScanifyDatabase : RoomDatabase() {
    abstract fun scanifyDao(): ScanifyDao

    companion object {
        @Volatile
        private var INSTANCE: ScanifyDatabase? = null

        fun getInstance(context: Context): ScanifyDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    ScanifyDatabase::class.java,
                    "scanify_local.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
