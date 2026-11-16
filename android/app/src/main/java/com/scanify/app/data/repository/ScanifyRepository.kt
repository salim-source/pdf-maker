package com.scanify.app.data.repository

import android.content.Context
import android.net.Uri
import com.scanify.app.data.local.ScanifyDao
import com.scanify.app.data.model.GeneratedQrEntity
import com.scanify.app.data.model.PdfDocumentEntity
import com.scanify.app.data.model.ScanHistoryEntity
import com.scanify.app.util.PdfHelper
import com.scanify.app.util.QrPayloadParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.util.UUID

class ScanifyRepository(
    private val context: Context,
    private val dao: ScanifyDao
) {
    val documents: Flow<List<PdfDocumentEntity>> = dao.observeDocuments()
    val scanHistory: Flow<List<ScanHistoryEntity>> = dao.observeScanHistory()
    val generatedQrs: Flow<List<GeneratedQrEntity>> = dao.observeGeneratedQrs()

    suspend fun importSafPdf(uri: Uri): PdfDocumentEntity? = withContext(Dispatchers.IO) {
        val doc = PdfHelper.inspectSafPdf(context, uri) ?: return@withContext null
        dao.upsertDocument(doc)
        doc
    }

    suspend fun getDocument(id: String): PdfDocumentEntity? = dao.getDocumentById(id)

    suspend fun updateReadingPosition(doc: PdfDocumentEntity, page: Int) {
        dao.updateDocument(doc.copy(lastPage = page, lastOpenedAt = System.currentTimeMillis()))
    }

    suspend fun toggleBookmark(doc: PdfDocumentEntity, page: Int): PdfDocumentEntity {
        val current = doc.bookmarks().toMutableSet()
        if (!current.add(page)) current.remove(page)
        val updated = doc.copy(bookmarksCsv = current.sorted().joinToString(","))
        dao.updateDocument(updated)
        return updated
    }

    suspend fun toggleDocumentFavorite(doc: PdfDocumentEntity) {
        dao.updateDocument(doc.copy(favorite = !doc.favorite))
    }

    suspend fun renameDocument(doc: PdfDocumentEntity, newName: String) {
        val sanitized = newName.trim().ifEmpty { doc.name }
        dao.updateDocument(doc.copy(name = sanitized))
    }

    suspend fun deleteDocument(id: String) = dao.deleteDocument(id)

    suspend fun recordScan(rawValue: String, formatName: String, isQr: Boolean): ScanHistoryEntity {
        val parsed = QrPayloadParser.parse(rawValue)
        val entity = ScanHistoryEntity(
            id = UUID.randomUUID().toString(),
            rawValue = rawValue,
            formatName = formatName,
            isQr = isQr,
            contentType = parsed.typeLabel,
            displayTitle = parsed.title,
            timestamp = System.currentTimeMillis(),
            favorite = false
        )
        dao.insertScan(entity)
        return entity
    }

    suspend fun toggleScanFavorite(id: String) = dao.toggleScanFavorite(id)
    suspend fun deleteScan(id: String) = dao.deleteScan(id)
    suspend fun clearScanHistory() = dao.clearScanHistory()

    suspend fun saveGeneratedQr(category: String, label: String, payload: String) {
        dao.insertGeneratedQr(
            GeneratedQrEntity(
                id = UUID.randomUUID().toString(),
                category = category,
                label = label,
                payload = payload,
                createdAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun deleteGeneratedQr(id: String) = dao.deleteGeneratedQr(id)

    suspend fun clearAllCache() {
        dao.clearAllDocuments()
        dao.clearScanHistory()
        dao.clearGeneratedQrs()
    }
}
