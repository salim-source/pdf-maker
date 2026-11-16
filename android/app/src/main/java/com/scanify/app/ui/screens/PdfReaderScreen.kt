package com.scanify.app.ui.screens

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bookmark
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.scanify.app.data.model.PdfDocumentEntity
import com.scanify.app.data.repository.ScanifyRepository
import com.scanify.app.util.PdfHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PdfReaderScreen(
    repository: ScanifyRepository,
    docId: String?
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val allDocs by repository.documents.collectAsState(initial = emptyList())

    var activeDoc by remember { mutableStateOf<PdfDocumentEntity?>(null) }
    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var showJumpDialog by remember { mutableStateOf(false) }
    var showBookmarksDialog by remember { mutableStateOf(false) }
    var showMetadataDialog by remember { mutableStateOf(false) }

    val openPdfLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            scope.launch {
                val imported = repository.importSafPdf(uri)
                if (imported != null) {
                    activeDoc = imported
                    scale = 1f
                    offsetX = 0f
                }
            }
        }
    }

    LaunchedEffect(docId, allDocs) {
        val targetId = docId ?: allDocs.firstOrNull()?.id
        if (targetId != null) {
            activeDoc = repository.getDocument(targetId)
        }
    }

    var pfd by remember { mutableStateOf<ParcelFileDescriptor?>(null) }
    var renderer by remember { mutableStateOf<PdfRenderer?>(null) }
    val renderMutex = remember { Mutex() }

    DisposableEffect(activeDoc?.uriString) {
        val uriStr = activeDoc?.uriString
        if (uriStr != null) {
            runCatching {
                val descriptor = context.contentResolver.openFileDescriptor(Uri.parse(uriStr), "r")
                pfd = descriptor
                renderer = descriptor?.let { PdfRenderer(it) }
            }
        }
        onDispose {
            renderer?.close()
            pfd?.close()
            renderer = null
            pfd = null
        }
    }

    val listState = rememberLazyListState()

    LaunchedEffect(activeDoc?.id, renderer) {
        val doc = activeDoc ?: return@LaunchedEffect
        if (renderer != null && doc.lastPage in 0 until doc.pageCount) {
            listState.scrollToItem(doc.lastPage)
        }
    }

    LaunchedEffect(listState, activeDoc?.id) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .collect { page ->
                val doc = activeDoc ?: return@collect
                if (page != doc.lastPage) {
                    repository.updateReadingPosition(doc, page)
                    activeDoc = doc.copy(lastPage = page)
                }
            }
    }

    val currentPage = listState.firstVisibleItemIndex
    val isBookmarked = activeDoc?.bookmarks()?.contains(currentPage) == true

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Column {
                    Text(
                        activeDoc?.name ?: "PDF Reader",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.titleMedium
                    )
                    activeDoc?.let {
                        Text(
                            "Page ${currentPage + 1} / ${it.pageCount}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            },
            actions = {
                IconButton(onClick = { openPdfLauncher.launch(arrayOf("application/pdf")) }) {
                    Icon(Icons.Outlined.FolderOpen, contentDescription = "Open PDF")
                }
                if (activeDoc != null) {
                    IconButton(onClick = {
                        scope.launch {
                            activeDoc = repository.toggleBookmark(activeDoc!!, currentPage)
                        }
                    }) {
                        Icon(
                            if (isBookmarked) Icons.Outlined.Bookmark else Icons.Outlined.BookmarkBorder,
                            contentDescription = "Bookmark page"
                        )
                    }
                    IconButton(onClick = { showMetadataDialog = true }) {
                        Icon(Icons.Outlined.Info, contentDescription = "PDF Metadata")
                    }
                    IconButton(onClick = {
                        PdfHelper.sharePdfUri(context, activeDoc!!.uriString, activeDoc!!.name)
                    }) {
                        Icon(Icons.Outlined.Share, contentDescription = "Share PDF")
                    }
                }
            }
        )

        if (activeDoc == null || renderer == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No PDF Opened", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Import any PDF from your Android device using Storage Access Framework.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { openPdfLauncher.launch(arrayOf("application/pdf")) }) {
                        Text("Select PDF File")
                    }
                }
            }
        } else {
            val doc = activeDoc!!
            val pdfRenderer = renderer!!

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(onClick = { showJumpDialog = true }, modifier = Modifier.weight(1f)) {
                    Text("Go to Page")
                }
                OutlinedButton(onClick = { showBookmarksDialog = true }, modifier = Modifier.weight(1f)) {
                    Text("Bookmarks (${doc.bookmarks().size})")
                }
                OutlinedButton(onClick = { scale = 1f; offsetX = 0f }) {
                    Text("${(scale * 100).toInt()}%")
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectTransformGestures { _, pan, zoom, _ ->
                            scale = (scale * zoom).coerceIn(1f, 3.2f)
                            if (scale > 1f) {
                                offsetX = (offsetX + pan.x).coerceIn(-600f, 600f)
                            } else {
                                offsetX = 0f
                            }
                        }
                    }
            ) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                            translationX = offsetX
                        },
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(pdfRenderer.pageCount, key = { pageIdx -> "${doc.id}_$pageIdx" }) { pageIndex ->
                        PdfPageBitmapView(
                            renderer = pdfRenderer,
                            pageIndex = pageIndex,
                            mutex = renderMutex
                        )
                    }
                }
            }
        }
    }

    if (showJumpDialog && activeDoc != null) {
        var input by remember { mutableStateOf((currentPage + 1).toString()) }
        AlertDialog(
            onDismissRequest = { showJumpDialog = false },
            title = { Text("Jump to Page") },
            text = {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it.filter { ch -> ch.isDigit() } },
                    label = { Text("Page (1 - ${activeDoc!!.pageCount})") },
                    singleLine = true
                )
            },
            confirmButton = {
                Button(onClick = {
                    val target = (input.toIntOrNull() ?: 1).coerceIn(1, activeDoc!!.pageCount) - 1
                    scope.launch { listState.scrollToItem(target) }
                    showJumpDialog = false
                }) { Text("Go") }
            },
            dismissButton = {
                TextButton(onClick = { showJumpDialog = false }) { Text("Cancel") }
            }
        )
    }

    if (showBookmarksDialog && activeDoc != null) {
        val bookmarks = activeDoc!!.bookmarks()
        AlertDialog(
            onDismissRequest = { showBookmarksDialog = false },
            title = { Text("Bookmarked Pages") },
            text = {
                if (bookmarks.isEmpty()) {
                    Text("No bookmarks saved for this document yet.")
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        bookmarks.forEach { page ->
                            OutlinedButton(
                                onClick = {
                                    scope.launch { listState.scrollToItem(page) }
                                    showBookmarksDialog = false
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Page ${page + 1}")
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showBookmarksDialog = false }) { Text("Close") }
            }
        )
    }

    if (showMetadataDialog && activeDoc != null) {
        val doc = activeDoc!!
        AlertDialog(
            onDismissRequest = { showMetadataDialog = false },
            title = { Text("PDF Metadata") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Name: ${doc.name}")
                    Text("Pages: ${doc.pageCount}")
                    Text("Size: ${PdfHelper.formatBytes(doc.sizeBytes)}")
                    Text("Bookmarks: ${doc.bookmarks().size}")
                }
            },
            confirmButton = {
                TextButton(onClick = { showMetadataDialog = false }) { Text("Close") }
            }
        )
    }
}

@Composable
private fun PdfPageBitmapView(
    renderer: PdfRenderer,
    pageIndex: Int,
    mutex: Mutex
) {
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = renderer, key2 = pageIndex) {
        value = withContext(Dispatchers.IO) {
            mutex.withLock {
                runCatching {
                    renderer.openPage(pageIndex).use { page ->
                        val targetWidth = 1240
                        val targetHeight = (targetWidth.toFloat() / page.width * page.height).toInt().coerceAtLeast(1)
                        Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888).apply {
                            eraseColor(AndroidColor.WHITE)
                            page.render(this, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        }
                    }
                }.getOrNull()
            }
        }
    }

    val aspect = bitmap?.let { it.width.toFloat() / it.height.toFloat() } ?: 0.72f

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
            .aspectRatio(aspect)
            .background(Color.White),
        contentAlignment = Alignment.Center
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = "PDF Page ${pageIndex + 1}",
                modifier = Modifier.fillMaxSize()
            )
        } else {
            CircularProgressIndicator()
        }
    }
}
