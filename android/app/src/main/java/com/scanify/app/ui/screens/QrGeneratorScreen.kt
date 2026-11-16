package com.scanify.app.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.scanify.app.data.repository.ScanifyRepository
import com.scanify.app.util.QrBitmapGenerator
import com.scanify.app.util.QrPayloadParser
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QrGeneratorScreen(repository: ScanifyRepository) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val categories = listOf("URL", "Text", "Wi-Fi", "Contact", "Email", "Phone")
    var selectedCategory by remember { mutableStateOf("URL") }

    var urlInput by remember { mutableStateOf("https://scanify.app") }
    var textInput by remember { mutableStateOf("") }
    var emailInput by remember { mutableStateOf("") }
    var phoneInput by remember { mutableStateOf("") }
    var wifiSsid by remember { mutableStateOf("") }
    var wifiPassword by remember { mutableStateOf("") }
    var wifiEncryption by remember { mutableStateOf("WPA") }
    var contactName by remember { mutableStateOf("") }
    var contactPhone by remember { mutableStateOf("") }
    var contactEmail by remember { mutableStateOf("") }
    var contactOrg by remember { mutableStateOf("") }

    val payload: String = when (selectedCategory) {
        "URL" -> urlInput.trim()
        "Text" -> textInput.trim()
        "Email" -> if (emailInput.isNotBlank()) "mailto:${emailInput.trim()}" else ""
        "Phone" -> if (phoneInput.isNotBlank()) "tel:${phoneInput.trim()}" else ""
        "Wi-Fi" -> if (wifiSsid.isNotBlank()) QrPayloadParser.buildWifiPayload(wifiSsid.trim(), wifiPassword, wifiEncryption, false) else ""
        "Contact" -> if (contactName.isNotBlank()) QrPayloadParser.buildVCardPayload(contactName.trim(), contactOrg.trim(), contactPhone.trim(), contactEmail.trim()) else ""
        else -> ""
    }

    val qrBitmap = remember(payload) {
        if (payload.isNotBlank()) QrBitmapGenerator.generate(payload, 640) else null
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("QR Code Generator") })

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                categories.forEach { cat ->
                    FilterChip(
                        selected = selectedCategory == cat,
                        onClick = { selectedCategory = cat },
                        label = { Text(cat) }
                    )
                }
            }

            when (selectedCategory) {
                "URL" -> OutlinedTextField(
                    value = urlInput,
                    onValueChange = { urlInput = it },
                    label = { Text("Website URL") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                "Text" -> OutlinedTextField(
                    value = textInput,
                    onValueChange = { textInput = it },
                    label = { Text("Text Content") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3
                )
                "Email" -> OutlinedTextField(
                    value = emailInput,
                    onValueChange = { emailInput = it },
                    label = { Text("Recipient Email") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                "Phone" -> OutlinedTextField(
                    value = phoneInput,
                    onValueChange = { phoneInput = it },
                    label = { Text("Phone Number") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                "Wi-Fi" -> {
                    OutlinedTextField(
                        value = wifiSsid,
                        onValueChange = { wifiSsid = it },
                        label = { Text("Network SSID") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = wifiPassword,
                        onValueChange = { wifiPassword = it },
                        label = { Text("Password") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
                "Contact" -> {
                    OutlinedTextField(
                        value = contactName,
                        onValueChange = { contactName = it },
                        label = { Text("Full Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = contactOrg,
                        onValueChange = { contactOrg = it },
                        label = { Text("Organization") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = contactPhone,
                        onValueChange = { contactPhone = it },
                        label = { Text("Phone") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = contactEmail,
                        onValueChange = { contactEmail = it },
                        label = { Text("Email") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    if (qrBitmap != null) {
                        Image(
                            bitmap = qrBitmap.asImageBitmap(),
                            contentDescription = "Generated QR Preview",
                            modifier = Modifier.size(220.dp)
                        )
                    } else {
                        Text(
                            "Enter valid details above to preview QR code.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    enabled = qrBitmap != null,
                    onClick = {
                        qrBitmap?.let { bmp ->
                            val saved = QrBitmapGenerator.saveToGallery(context, bmp, "scanify_qr_${System.currentTimeMillis()}")
                            Toast.makeText(
                                context,
                                if (saved != null) "Saved QR to Pictures/Scanify" else "Failed to save image",
                                Toast.LENGTH_SHORT
                            ).show()
                            scope.launch {
                                repository.saveGeneratedQr(selectedCategory, payload.take(40), payload)
                            }
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) { Text("Save PNG") }

                OutlinedButton(
                    enabled = qrBitmap != null,
                    onClick = {
                        qrBitmap?.let { QrBitmapGenerator.shareQrBitmap(context, it, payload) }
                    },
                    modifier = Modifier.weight(1f)
                ) { Text("Share") }

                OutlinedButton(
                    enabled = payload.isNotBlank(),
                    onClick = {
                        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        cm.setPrimaryClip(ClipData.newPlainText("Scanify QR", payload))
                        Toast.makeText(context, "Copied content", Toast.LENGTH_SHORT).show()
                    }
                ) { Text("Copy") }
            }
        }
    }
}
