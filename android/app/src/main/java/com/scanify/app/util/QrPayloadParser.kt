package com.scanify.app.util

import android.net.Uri
import com.scanify.app.data.model.ParsedQrResult

object QrPayloadParser {
    fun parse(rawValue: String): ParsedQrResult {
        val trimmed = rawValue.trim()

        if (trimmed.startsWith("WIFI:", ignoreCase = true)) {
            val ssid = Regex("S:([^;]+)").find(trimmed)?.groupValues?.getOrNull(1) ?: "Wi-Fi Network"
            val encryption = Regex("T:([^;]+)").find(trimmed)?.groupValues?.getOrNull(1) ?: "WPA"
            val password = Regex("P:([^;]+)").find(trimmed)?.groupValues?.getOrNull(1) ?: ""
            val hidden = Regex("H:([^;]+)").find(trimmed)?.groupValues?.getOrNull(1)?.equals("true", true) == true
            return ParsedQrResult.WifiResult(ssid, encryption, password, hidden)
        }

        if (trimmed.contains("BEGIN:VCARD", ignoreCase = true)) {
            val lines = trimmed.lines()
            val fn = lines.firstOrNull { it.startsWith("FN:", true) }?.substringAfter(":")?.trim()
            val org = lines.firstOrNull { it.startsWith("ORG:", true) }?.substringAfter(":")?.trim()
            val tel = lines.firstOrNull { it.startsWith("TEL", true) }?.substringAfter(":")?.trim()
            val email = lines.firstOrNull { it.startsWith("EMAIL", true) }?.substringAfter(":")?.trim()
            return ParsedQrResult.ContactResult(
                name = fn ?: "Contact Card",
                organization = org,
                phone = tel,
                email = email,
                rawVCard = trimmed
            )
        }

        if (trimmed.startsWith("mailto:", ignoreCase = true)) {
            val uri = Uri.parse(trimmed)
            val address = uri.schemeSpecificPart.substringBefore("?")
            return ParsedQrResult.EmailResult(
                address = address,
                subject = uri.getQueryParameter("subject"),
                body = uri.getQueryParameter("body")
            )
        }

        if (trimmed.startsWith("tel:", ignoreCase = true)) {
            return ParsedQrResult.PhoneResult(trimmed.substring(4).trim())
        }

        if (Regex("^https?://\\S+", RegexOption.IGNORE_CASE).matches(trimmed)) {
            return ParsedQrResult.UrlResult(trimmed)
        }

        return ParsedQrResult.TextResult(trimmed)
    }

    fun buildWifiPayload(ssid: String, password: String, encryption: String, hidden: Boolean): String {
        val parts = buildList {
            add("T:$encryption")
            add("S:$ssid")
            if (encryption != "nopass" && password.isNotEmpty()) add("P:$password")
            if (hidden) add("H:true")
        }
        return "WIFI:${parts.joinToString(";")};;"
    }

    fun buildVCardPayload(name: String, org: String, phone: String, email: String): String {
        return buildList {
            add("BEGIN:VCARD")
            add("VERSION:3.0")
            add("FN:$name")
            if (org.isNotBlank()) add("ORG:$org")
            if (phone.isNotBlank()) add("TEL;TYPE=CELL:$phone")
            if (email.isNotBlank()) add("EMAIL:$email")
            add("END:VCARD")
        }.joinToString("\n")
    }
}
