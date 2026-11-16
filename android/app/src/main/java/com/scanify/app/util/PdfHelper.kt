package com.scanify.app.util

import android.content.Context
import android.content.Intent
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.provider.OpenableColumns
import com.scanify.app.data.model.PdfDocumentEntity
import java.util.UUID

object PdfHelper {
    fun takePersistableReadPermission(context: Context, uri: Uri) {
        runCatching {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        }
    }

    fun inspectSafPdf(context: Context, uri: Uri): PdfDocumentEntity? {
        takePersistableReadPermission(context, uri)
        var name = "Document.pdf"
        var size = 0L

        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (nameIndex >= 0) name = cursor.getString(nameIndex) ?: name
                if (sizeIndex >= 0) size = cursor.getLong(sizeIndex)
            }
        }

        val pageCount = context.contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
            PdfRenderer(pfd).use { renderer -> renderer.pageCount }
        } ?: return null

        val now = System.currentTimeMillis()
        return PdfDocumentEntity(
            id = UUID.randomUUID().toString(),
            uriString = uri.toString(),
            name = name,
            sizeBytes = size,
            pageCount = pageCount,
            lastPage = 0,
            bookmarksCsv = "",
            favorite = false,
            addedAt = now,
            lastOpenedAt = now
        )
    }

    fun sharePdfUri(context: Context, uriString: String, title: String) {
        val uri = Uri.parse(uriString)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, title)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share PDF"))
    }

    fun formatBytes(bytes: Long): String {
        if (bytes <= 0L) return "0 B"
        val units = arrayOf("B", "KB", "MB", "GB")
        var value = bytes.toDouble()
        var idx = 0
        while (value >= 1024 && idx < units.lastIndex) {
            value /= 1024
            idx++
        }
        return if (idx == 0) "${value.toInt()} B" else String.format("%.1f %s", value, units[idx])
    }
}
