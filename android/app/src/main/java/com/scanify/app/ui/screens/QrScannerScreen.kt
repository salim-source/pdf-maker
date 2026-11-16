package com.scanify.app.ui.screens

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.view.ViewGroup
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Cameraswitch
import androidx.compose.material.icons.outlined.FlashlightOff
import androidx.compose.material.icons.outlined.FlashlightOn
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.scanify.app.data.local.PreferencesRepository
import com.scanify.app.data.model.ParsedQrResult
import com.scanify.app.data.model.ScanHistoryEntity
import com.scanify.app.data.repository.ScanifyRepository
import com.scanify.app.util.FeedbackHelper
import com.scanify.app.util.QrPayloadParser
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QrScannerScreen(
    repository: ScanifyRepository,
    preferencesRepository: PreferencesRepository
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    val prefs by preferencesRepository.state.collectAsState()

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
    }

    var lensFacing by remember { mutableIntStateOf(CameraSelector.LENS_FACING_BACK) }
    var torchEnabled by remember { mutableStateOf(false) }
    var boundCamera by remember { mutableStateOf<Camera?>(null) }
    var latestScan by remember { mutableStateOf<ScanHistoryEntity?>(null) }
    var pendingExternalUrl by remember { mutableStateOf<String?>(null) }
    var lastScannedRaw by remember { mutableStateOf("") }
    var lastScanTime by remember { mutableStateOf(0L) }

    val imagePicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                val image = InputImage.fromFilePath(context, uri)
                BarcodeScanning.getClient().process(image)
                    .addOnSuccessListener { barcodes ->
                        val first = barcodes.firstOrNull()?.rawValue ?: return@addOnSuccessListener
                        val format = barcodes.first().format
                        scope.launch {
                            FeedbackHelper.playSuccessTone(prefs.soundEnabled)
                            FeedbackHelper.vibrate(context, prefs.vibrationEnabled)
                            latestScan = repository.recordScan(
                                rawValue = first,
                                formatName = formatName(format),
                                isQr = format == Barcode.FORMAT_QR_CODE
                            )
                        }
                    }
            }
        }
    }

    val analyzerExecutor = remember { Executors.newSingleThreadExecutor() }
    DisposableEffect(Unit) {
        onDispose { analyzerExecutor.shutdown() }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("QR & Barcode Scanner") },
            actions = {
                IconButton(onClick = { imagePicker.launch("image/*") }) {
                    Icon(Icons.Outlined.Image, contentDescription = "Scan from Image")
                }
                IconButton(
                    enabled = boundCamera?.cameraInfo?.hasFlashUnit() == true,
                    onClick = {
                        val next = !torchEnabled
                        boundCamera?.cameraControl?.enableTorch(next)
                        torchEnabled = next
                    }
                ) {
                    Icon(
                        if (torchEnabled) Icons.Outlined.FlashlightOn else Icons.Outlined.FlashlightOff,
                        contentDescription = "Toggle Flashlight"
                    )
                }
                IconButton(onClick = {
                    torchEnabled = false
                    lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                        CameraSelector.LENS_FACING_FRONT
                    } else {
                        CameraSelector.LENS_FACING_BACK
                    }
                }) {
                    Icon(Icons.Outlined.Cameraswitch, contentDescription = "Switch Camera")
                }
            }
        )

        if (!hasCameraPermission) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Camera Permission Needed", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Scanify uses your camera locally to decode QR codes and barcodes. You can also scan an image from your gallery.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                            Text("Grant Camera")
                        }
                        OutlinedButton(onClick = { imagePicker.launch("image/*") }) {
                            Text("Pick Image")
                        }
                    }
                }
            }
        } else {
            Box(modifier = Modifier.fillMaxSize()) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        PreviewView(ctx).apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }
                    },
                    update = { previewView ->
                        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
                        cameraProviderFuture.addListener({
                            val cameraProvider = cameraProviderFuture.get()
                            val preview = Preview.Builder().build().also {
                                it.surfaceProvider = previewView.surfaceProvider
                            }

                            val scanner = BarcodeScanning.getClient()
                            val analysis = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()

                            analysis.setAnalyzer(analyzerExecutor) { imageProxy ->
                                val mediaImage = imageProxy.image
                                if (mediaImage != null && latestScan == null) {
                                    val input = InputImage.fromMediaImage(
                                        mediaImage,
                                        imageProxy.imageInfo.rotationDegrees
                                    )
                                    scanner.process(input)
                                        .addOnSuccessListener { barcodes ->
                                            val barcode = barcodes.firstOrNull()
                                            val raw = barcode?.rawValue
                                            val now = System.currentTimeMillis()
                                            if (!raw.isNullOrBlank() && (raw != lastScannedRaw || now - lastScanTime > 3000)) {
                                                lastScannedRaw = raw
                                                lastScanTime = now
                                                scope.launch {
                                                    FeedbackHelper.playSuccessTone(prefs.soundEnabled)
                                                    FeedbackHelper.vibrate(context, prefs.vibrationEnabled)
                                                    latestScan = repository.recordScan(
                                                        rawValue = raw,
                                                        formatName = formatName(barcode.format),
                                                        isQr = barcode.format == Barcode.FORMAT_QR_CODE
                                                    )
                                                }
                                            }
                                        }
                                        .addOnCompleteListener { imageProxy.close() }
                                } else {
                                    imageProxy.close()
                                }
                            }

                            val selector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
                            runCatching {
                                cameraProvider.unbindAll()
                                boundCamera = cameraProvider.bindToLifecycle(
                                    lifecycleOwner,
                                    selector,
                                    preview,
                                    analysis
                                )
                            }
                        }, ContextCompat.getMainExecutor(context))
                    }
                )

                ScannerReticleOverlay(modifier = Modifier.fillMaxSize())
            }
        }
    }

    latestScan?.let { scan ->
        val parsed = QrPayloadParser.parse(scan.rawValue)
        AlertDialog(
            onDismissRequest = { latestScan = null },
            title = { Text(parsed.typeLabel) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(parsed.title, style = MaterialTheme.typography.titleMedium)
                    when (parsed) {
                        is ParsedQrResult.WifiResult -> {
                            Text("SSID: ${parsed.ssid}")
                            Text("Security: ${parsed.encryption}")
                            if (parsed.password.isNotEmpty()) Text("Password: ${parsed.password}")
                        }
                        is ParsedQrResult.ContactResult -> {
                            parsed.organization?.let { Text("Org: $it") }
                            parsed.phone?.let { Text("Phone: $it") }
                            parsed.email?.let { Text("Email: $it") }
                        }
                        else -> Text(scan.rawValue, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (parsed is ParsedQrResult.UrlResult) {
                        Button(onClick = {
                            if (prefs.confirmBeforeOpeningUrls) {
                                pendingExternalUrl = parsed.url
                            } else {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(parsed.url)))
                            }
                        }) { Text("Open URL") }
                    }
                    OutlinedButton(onClick = {
                        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        cm.setPrimaryClip(ClipData.newPlainText("Scanify", scan.rawValue))
                        latestScan = null
                    }) { Text("Copy") }
                }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = {
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, scan.rawValue)
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share Scan Result"))
                    }) { Text("Share") }
                    TextButton(onClick = { latestScan = null }) { Text("Done") }
                }
            }
        )
    }

    pendingExternalUrl?.let { url ->
        AlertDialog(
            onDismissRequest = { pendingExternalUrl = null },
            title = { Text("Open External Link?") },
            text = { Text("Verify you trust this URL before opening it in your browser:\n\n$url") },
            confirmButton = {
                Button(onClick = {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    pendingExternalUrl = null
                    latestScan = null
                }) { Text("Open Browser") }
            },
            dismissButton = {
                TextButton(onClick = { pendingExternalUrl = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun ScannerReticleOverlay(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "scanLine")
    val progress by transition.animateFloat(
        initialValue = 0.08f,
        targetValue = 0.92f,
        animationSpec = infiniteRepeatable(
            animation = tween(2200, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scanBeamProgress"
    )

    Canvas(modifier = modifier) {
        val boxSize = size.minDimension * 0.62f
        val left = (size.width - boxSize) / 2f
        val top = (size.height - boxSize) / 2f

        drawRect(color = Color.Black.copy(alpha = 0.35f))
        drawRect(
            color = Color(0xFF3B82F6),
            topLeft = Offset(left, top),
            size = Size(boxSize, boxSize),
            style = Stroke(width = 5f)
        )
        val beamY = top + boxSize * progress
        drawLine(
            color = Color(0xFF8B5CF6),
            start = Offset(left + 16f, beamY),
            end = Offset(left + boxSize - 16f, beamY),
            strokeWidth = 4f
        )
    }
}

private fun formatName(format: Int): String = when (format) {
    Barcode.FORMAT_QR_CODE -> "QR_CODE"
    Barcode.FORMAT_EAN_13 -> "EAN_13"
    Barcode.FORMAT_EAN_8 -> "EAN_8"
    Barcode.FORMAT_UPC_A -> "UPC_A"
    Barcode.FORMAT_CODE_128 -> "CODE_128"
    Barcode.FORMAT_CODE_39 -> "CODE_39"
    Barcode.FORMAT_DATA_MATRIX -> "DATA_MATRIX"
    Barcode.FORMAT_PDF417 -> "PDF_417"
    else -> "BARCODE"
}
