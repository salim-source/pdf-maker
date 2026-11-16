package com.scanify.app.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class ThemeMode {
    DARK, LIGHT, SYSTEM
}

data class UserPreferences(
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val confirmBeforeOpeningUrls: Boolean = true
)

@Entity(tableName = "pdf_documents")
data class PdfDocumentEntity(
    @PrimaryKey val id: String,
    val uriString: String,
    val name: String,
    val sizeBytes: Long,
    val pageCount: Int,
    val lastPage: Int = 0,
    val bookmarksCsv: String = "",
    val favorite: Boolean = false,
    val addedAt: Long,
    val lastOpenedAt: Long
) {
    fun bookmarks(): List<Int> =
        bookmarksCsv.split(",").mapNotNull { it.trim().toIntOrNull() }.sorted()
}

@Entity(tableName = "scan_history")
data class ScanHistoryEntity(
    @PrimaryKey val id: String,
    val rawValue: String,
    val formatName: String,
    val isQr: Boolean,
    val contentType: String,
    val displayTitle: String,
    val timestamp: Long,
    val favorite: Boolean = false
)

@Entity(tableName = "generated_qr")
data class GeneratedQrEntity(
    @PrimaryKey val id: String,
    val category: String,
    val label: String,
    val payload: String,
    val createdAt: Long
)

sealed class ParsedQrResult(val title: String, val typeLabel: String) {
    data class UrlResult(val url: String) : ParsedQrResult(url, "URL")
    data class WifiResult(
        val ssid: String,
        val encryption: String,
        val password: String,
        val hidden: Boolean
    ) : ParsedQrResult(ssid, "Wi-Fi")
    data class ContactResult(
        val name: String,
        val organization: String?,
        val phone: String?,
        val email: String?,
        val rawVCard: String
    ) : ParsedQrResult(name, "Contact")
    data class EmailResult(val address: String, val subject: String?, val body: String?) :
        ParsedQrResult(address, "Email")
    data class PhoneResult(val number: String) : ParsedQrResult(number, "Phone")
    data class TextResult(val text: String) : ParsedQrResult(text.take(48), "Text")
}
