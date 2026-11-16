package com.scanify.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.scanify.app.data.model.PdfDocumentEntity
import com.scanify.app.data.repository.ScanifyRepository
import com.scanify.app.util.PdfHelper
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PdfManagerScreen(
    repository: ScanifyRepository,
    onOpenDoc: (String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val documents by repository.documents.collectAsState(initial = emptyList())

    var query by remember { mutableStateOf("") }
    var sortBy by remember { mutableStateOf("Date") }
    var favoritesOnly by remember { mutableStateOf(false) }
    var renamingDoc by remember { mutableStateOf<PdfDocumentEntity?>(null) }
    var renameText by remember { mutableStateOf("") }

    val openPdfLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            scope.launch { repository.importSafPdf(uri) }
        }
    }

    val processed = remember(documents, query, sortBy, favoritesOnly) {
        val q = query.trim().lowercase()
        val filtered = documents.filter { doc ->
            (!favoritesOnly || doc.favorite) &&
                (q.isEmpty() || doc.name.lowercase().contains(q))
        }
        when (sortBy) {
            "Name" -> filtered.sortedBy { it.name.lowercase() }
            "Size" -> filtered.sortedByDescending { it.sizeBytes }
            else -> filtered.sortedByDescending { it.lastOpenedAt }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("PDF Library") },
            actions = {
                IconButton(onClick = { openPdfLauncher.launch(arrayOf("application/pdf")) }) {
                    Icon(Icons.Outlined.Add, contentDescription = "Import PDF")
                }
            }
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Search documents...") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Date", "Name", "Size").forEach { mode ->
                    FilterChip(
                        selected = sortBy == mode,
                        onClick = { sortBy = mode },
                        label = { Text(mode) }
                    )
                }
                FilterChip(
                    selected = favoritesOnly,
                    onClick = { favoritesOnly = !favoritesOnly },
                    label = { Text("Favorites") }
                )
            }
        }

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(processed, key = { it.id }) { doc ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenDoc(doc.id) }
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(doc.name, style = MaterialTheme.typography.titleMedium)
                        Text(
                            "Page ${doc.lastPage + 1}/${doc.pageCount} · ${PdfHelper.formatBytes(doc.sizeBytes)}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = { scope.launch { repository.toggleDocumentFavorite(doc) } }) {
                        Icon(
                            if (doc.favorite) Icons.Outlined.Star else Icons.Outlined.StarOutline,
                            contentDescription = "Favorite"
                        )
                    }
                    IconButton(onClick = {
                        renamingDoc = doc
                        renameText = doc.name
                    }) {
                        Icon(Icons.Outlined.Edit, contentDescription = "Rename")
                    }
                    IconButton(onClick = { PdfHelper.sharePdfUri(context, doc.uriString, doc.name) }) {
                        Icon(Icons.Outlined.Share, contentDescription = "Share")
                    }
                    IconButton(onClick = { scope.launch { repository.deleteDocument(doc.id) } }) {
                        Icon(Icons.Outlined.Delete, contentDescription = "Delete")
                    }
                }
                HorizontalDivider()
            }
        }
    }

    renamingDoc?.let { doc ->
        AlertDialog(
            onDismissRequest = { renamingDoc = null },
            title = { Text("Rename Document") },
            text = {
                OutlinedTextField(
                    value = renameText,
                    onValueChange = { renameText = it },
                    singleLine = true
                )
            },
            confirmButton = {
                Button(onClick = {
                    scope.launch {
                        repository.renameDocument(doc, renameText)
                        renamingDoc = null
                    }
                }) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { renamingDoc = null }) { Text("Cancel") }
            }
        )
    }
}
