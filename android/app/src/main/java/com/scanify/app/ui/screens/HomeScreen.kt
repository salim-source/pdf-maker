package com.scanify.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.scanify.app.data.repository.ScanifyRepository
import com.scanify.app.util.PdfHelper

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    repository: ScanifyRepository,
    onOpenReader: (String?) -> Unit,
    onOpenScanner: () -> Unit,
    onOpenGenerator: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenSettings: () -> Unit
) {
    val documents by repository.documents.collectAsState(initial = emptyList())
    val scans by repository.scanHistory.collectAsState(initial = emptyList())
    val favoritesCount = documents.count { it.favorite } + scans.count { it.favorite }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Scanify", style = MaterialTheme.typography.headlineSmall) },
            actions = {
                IconButton(onClick = onOpenHistory) {
                    Icon(Icons.Outlined.History, contentDescription = "Scan History")
                }
                IconButton(onClick = onOpenSettings) {
                    Icon(Icons.Outlined.Settings, contentDescription = "Settings")
                }
            }
        )

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = { onOpenReader(null) },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Outlined.Description, contentDescription = null)
                        Text("  PDF Reader")
                    }
                    Button(
                        onClick = onOpenScanner,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Outlined.QrCodeScanner, contentDescription = null)
                        Text("  Scan QR")
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = onOpenGenerator,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Outlined.QrCode2, contentDescription = null)
                    Text("  Create QR Code")
                }
            }

            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        StatColumn("Documents", documents.size.toString())
                        StatColumn("Scans", scans.size.toString())
                        StatColumn("Favorites", favoritesCount.toString())
                    }
                }
            }

            item {
                Text("Recent Documents", style = MaterialTheme.typography.titleMedium)
            }

            if (documents.isEmpty()) {
                item {
                    Text(
                        "No PDF documents opened yet. Tap PDF Reader to select a file.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                items(documents.take(4), key = { it.id }) { doc ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpenReader(doc.id) }
                            .padding(vertical = 8.dp)
                    ) {
                        Text(doc.name, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "Page ${doc.lastPage + 1} of ${doc.pageCount} · ${PdfHelper.formatBytes(doc.sizeBytes)}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    HorizontalDivider()
                }
            }

            item {
                Text("Recent Scans", style = MaterialTheme.typography.titleMedium)
            }

            if (scans.isEmpty()) {
                item {
                    Text(
                        "No QR codes or barcodes scanned yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                items(scans.take(4), key = { it.id }) { scan ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpenHistory() }
                            .padding(vertical = 8.dp)
                    ) {
                        Text(scan.displayTitle, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "${scan.formatName} · ${scan.contentType}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    HorizontalDivider()
                }
            }

            item { Spacer(modifier = Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun StatColumn(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.headlineSmall)
    }
}
