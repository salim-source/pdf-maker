package com.scanify.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.DeleteSweep
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.unit.dp
import com.scanify.app.data.repository.ScanifyRepository
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(repository: ScanifyRepository) {
    val history by repository.scanHistory.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf("All") }
    var showClearConfirm by remember { mutableStateOf(false) }

    val filtered = remember(history, query, filter) {
        val q = query.trim().lowercase()
        history.filter { item ->
            val matchFilter = when (filter) {
                "QR" -> item.isQr
                "Barcode" -> !item.isQr
                "Favorites" -> item.favorite
                else -> true
            }
            val matchQuery = q.isEmpty() ||
                item.rawValue.lowercase().contains(q) ||
                item.displayTitle.lowercase().contains(q) ||
                item.formatName.lowercase().contains(q)
            matchFilter && matchQuery
        }
    }

    val dateFormatter = remember { SimpleDateFormat("MMM d, HH:mm", Locale.getDefault()) }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Scan History") },
            actions = {
                if (history.isNotEmpty()) {
                    IconButton(onClick = { showClearConfirm = true }) {
                        Icon(Icons.Outlined.DeleteSweep, contentDescription = "Clear All History")
                    }
                }
            }
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Search scans...") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("All", "QR", "Barcode", "Favorites").forEach { tab ->
                    FilterChip(
                        selected = filter == tab,
                        onClick = { filter = tab },
                        label = { Text(tab) }
                    )
                }
            }
        }

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(filtered, key = { it.id }) { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(item.displayTitle, style = MaterialTheme.typography.titleMedium)
                        Text(
                            item.rawValue,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1
                        )
                        Text(
                            "${item.formatName} · ${dateFormatter.format(Date(item.timestamp))}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = { scope.launch { repository.toggleScanFavorite(item.id) } }) {
                        Icon(
                            if (item.favorite) Icons.Outlined.Star else Icons.Outlined.StarOutline,
                            contentDescription = "Favorite"
                        )
                    }
                    IconButton(onClick = { scope.launch { repository.deleteScan(item.id) } }) {
                        Icon(Icons.Outlined.Delete, contentDescription = "Delete")
                    }
                }
                HorizontalDivider()
            }
        }
    }

    if (showClearConfirm) {
        AlertDialog(
            onDismissRequest = { showClearConfirm = false },
            title = { Text("Clear All History?") },
            text = { Text("All saved QR code and barcode scans will be permanently deleted.") },
            confirmButton = {
                Button(
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    onClick = {
                        scope.launch {
                            repository.clearScanHistory()
                            showClearConfirm = false
                        }
                    }
                ) { Text("Clear All") }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirm = false }) { Text("Cancel") }
            }
        )
    }
}
