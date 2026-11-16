package com.scanify.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.scanify.app.data.model.GeneratedQrEntity
import com.scanify.app.data.model.PdfDocumentEntity
import com.scanify.app.data.model.ScanHistoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ScanifyDao {
    @Query("SELECT * FROM pdf_documents ORDER BY lastOpenedAt DESC")
    fun observeDocuments(): Flow<List<PdfDocumentEntity>>

    @Query("SELECT * FROM pdf_documents WHERE id = :id LIMIT 1")
    suspend fun getDocumentById(id: String): PdfDocumentEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDocument(doc: PdfDocumentEntity)

    @Update
    suspend fun updateDocument(doc: PdfDocumentEntity)

    @Query("DELETE FROM pdf_documents WHERE id = :id")
    suspend fun deleteDocument(id: String)

    @Query("DELETE FROM pdf_documents")
    suspend fun clearAllDocuments()

    @Query("SELECT * FROM scan_history ORDER BY timestamp DESC")
    fun observeScanHistory(): Flow<List<ScanHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertScan(scan: ScanHistoryEntity)

    @Query("UPDATE scan_history SET favorite = NOT favorite WHERE id = :id")
    suspend fun toggleScanFavorite(id: String)

    @Query("DELETE FROM scan_history WHERE id = :id")
    suspend fun deleteScan(id: String)

    @Query("DELETE FROM scan_history")
    suspend fun clearScanHistory()

    @Query("SELECT * FROM generated_qr ORDER BY createdAt DESC")
    fun observeGeneratedQrs(): Flow<List<GeneratedQrEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGeneratedQr(qr: GeneratedQrEntity)

    @Query("DELETE FROM generated_qr WHERE id = :id")
    suspend fun deleteGeneratedQr(id: String)

    @Query("DELETE FROM generated_qr")
    suspend fun clearGeneratedQrs()
}
