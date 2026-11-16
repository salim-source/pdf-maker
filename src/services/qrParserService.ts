import type {
  ContactScanData,
  EmailScanData,
  ParsedScanData,
  QrGeneratorCategory,
  WifiScanData,
} from '../types';

function unescapeWifiField(value: string): string {
  return value.replace(/\\([\\;,:"])/g, '$1');
}

function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

export function parseWifiPayload(raw: string): WifiScanData | null {
  if (!/^WIFI:/i.test(raw)) return null;
  const body = raw.slice(5);
  const fields: Record<string, string> = {};
  let currentKey = '';
  let currentVal = '';
  let readingKey = true;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (readingKey) {
      if (ch === ':') {
        readingKey = false;
      } else if (ch === ';') {
        currentKey = '';
      } else {
        currentKey += ch;
      }
    } else {
      if (ch === '\\' && i + 1 < body.length) {
        currentVal += body[i + 1];
        i++;
      } else if (ch === ';') {
        if (currentKey) {
          fields[currentKey.toUpperCase()] = currentVal;
        }
        currentKey = '';
        currentVal = '';
        readingKey = true;
      } else {
        currentVal += ch;
      }
    }
  }
  if (currentKey) {
    fields[currentKey.toUpperCase()] = currentVal;
  }

  return {
    ssid: unescapeWifiField(fields.S || 'Hidden Network'),
    encryption: (fields.T || 'nopass').toUpperCase() === 'NOPASS' ? 'nopass' : fields.T || 'WPA',
    password: unescapeWifiField(fields.P || ''),
    hidden: (fields.H || '').toLowerCase() === 'true',
  };
}

export function parseVCardPayload(raw: string): ContactScanData | null {
  if (!/BEGIN:VCARD/i.test(raw) && !/^MECARD:/i.test(raw)) return null;

  if (/^MECARD:/i.test(raw)) {
    const body = raw.slice(7);
    const getField = (prefix: string) => {
      const match = body.match(new RegExp(`${prefix}:([^;]+)`, 'i'));
      return match ? match[1].trim() : undefined;
    };
    const name = getField('N') || 'Contact';
    const phone = getField('TEL');
    const email = getField('EMAIL');
    const url = getField('URL');
    const address = getField('ADR');
    const org = getField('ORG');
    return {
      name: name.replace(',', ' ').trim(),
      organization: org,
      phone,
      email,
      url,
      address,
      rawVCard: [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${name.replace(',', ' ').trim()}`,
        org ? `ORG:${org}` : '',
        phone ? `TEL:${phone}` : '',
        email ? `EMAIL:${email}` : '',
        url ? `URL:${url}` : '',
        address ? `ADR:${address}` : '',
        'END:VCARD',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  const lines = raw.split(/\r?\n/);
  let fn = '';
  let n = '';
  let org = '';
  let phone = '';
  let email = '';
  let url = '';
  let address = '';

  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const keyPart = line.slice(0, idx).toUpperCase();
    const val = line.slice(idx + 1).trim();
    const key = keyPart.split(';')[0];

    if (key === 'FN' && !fn) fn = val;
    else if (key === 'N' && !n) n = val.split(';').filter(Boolean).reverse().join(' ');
    else if (key === 'ORG' && !org) org = val.replace(/;/g, ' ').trim();
    else if (key === 'TEL' && !phone) phone = val;
    else if (key === 'EMAIL' && !email) email = val;
    else if (key === 'URL' && !url) url = val;
    else if (key === 'ADR' && !address) address = val.split(';').filter(Boolean).join(', ');
  }

  return {
    name: fn || n || 'Contact Card',
    organization: org || undefined,
    phone: phone || undefined,
    email: email || undefined,
    url: url || undefined,
    address: address || undefined,
    rawVCard: raw,
  };
}

export function parseEmailPayload(raw: string): EmailScanData | null {
  if (/^mailto:/i.test(raw)) {
    const withoutScheme = raw.slice(7);
    const [addressPart, queryPart] = withoutScheme.split('?');
    const params = new URLSearchParams(queryPart || '');
    return {
      address: decodeURIComponent(addressPart || ''),
      subject: params.get('subject') || undefined,
      body: params.get('body') || undefined,
    };
  }
  if (/^MATMSG:/i.test(raw)) {
    const to = raw.match(/TO:([^;]+)/i)?.[1]?.trim() || '';
    const sub = raw.match(/SUB:([^;]+)/i)?.[1]?.trim();
    const body = raw.match(/BODY:([^;]+)/i)?.[1]?.trim();
    if (to) return { address: to, subject: sub, body };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
    return { address: raw.trim() };
  }
  return null;
}

export function parseScanPayload(rawValue: string): ParsedScanData {
  const trimmed = rawValue.trim();

  const wifi = parseWifiPayload(trimmed);
  if (wifi) {
    return {
      type: 'wifi',
      displayTitle: wifi.ssid,
      subtitle: `Wi-Fi · ${wifi.encryption === 'nopass' ? 'Open Network' : wifi.encryption}`,
      wifi,
      text: trimmed,
    };
  }

  const contact = parseVCardPayload(trimmed);
  if (contact) {
    return {
      type: 'contact',
      displayTitle: contact.name,
      subtitle: contact.organization || contact.phone || contact.email || 'Contact Card',
      contact,
      text: trimmed,
    };
  }

  const email = parseEmailPayload(trimmed);
  if (email) {
    return {
      type: 'email',
      displayTitle: email.address,
      subtitle: email.subject ? `Email · ${email.subject}` : 'Email Address',
      email,
      text: trimmed,
    };
  }

  if (/^tel:/i.test(trimmed)) {
    const phone = trimmed.slice(4).trim();
    return {
      type: 'phone',
      displayTitle: phone,
      subtitle: 'Phone Number',
      phone,
      text: trimmed,
    };
  }

  if (/^\+?[\d\s\-()]{7,20}$/.test(trimmed) && /\d{5,}/.test(trimmed.replace(/\D/g, ''))) {
    return {
      type: 'phone',
      displayTitle: trimmed,
      subtitle: 'Phone Number',
      phone: trimmed,
      text: trimmed,
    };
  }

  if (/^https?:\/\/\S+/i.test(trimmed)) {
    try {
      const urlObj = new URL(trimmed);
      return {
        type: 'url',
        displayTitle: urlObj.hostname,
        subtitle: trimmed,
        url: urlObj.toString(),
        text: trimmed,
      };
    } catch {
      // fall through to text
    }
  }

  return {
    type: 'text',
    displayTitle: trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed,
    subtitle: `${trimmed.length} characters`,
    text: trimmed,
  };
}

export function isQrFormat(format: string): boolean {
  const normalized = format.toUpperCase();
  return normalized.includes('QR');
}

export interface GeneratorFormValues {
  url: string;
  text: string;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  phone: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiEncryption: 'WPA' | 'WEP' | 'nopass';
  wifiHidden: boolean;
  contactName: string;
  contactOrg: string;
  contactPhone: string;
  contactEmail: string;
  contactUrl: string;
}

export function buildQrPayload(
  category: QrGeneratorCategory,
  values: GeneratorFormValues
): { payload: string; label: string; error?: string } {
  switch (category) {
    case 'url': {
      const raw = values.url.trim();
      if (!raw) return { payload: '', label: '', error: 'Enter a website URL.' };
      const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
        const parsed = new URL(normalized);
        return { payload: parsed.toString(), label: parsed.hostname };
      } catch {
        return { payload: '', label: '', error: 'Enter a valid URL (e.g., https://example.com).' };
      }
    }
    case 'text': {
      const raw = values.text.trim();
      if (!raw) return { payload: '', label: '', error: 'Enter text content to encode.' };
      if (raw.length > 2000) {
        return { payload: '', label: '', error: 'Text must be 2,000 characters or fewer.' };
      }
      return {
        payload: raw,
        label: raw.length > 36 ? `${raw.slice(0, 36)}…` : raw,
      };
    }
    case 'email': {
      const to = values.emailTo.trim();
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return { payload: '', label: '', error: 'Enter a valid recipient email address.' };
      }
      const params = new URLSearchParams();
      if (values.emailSubject.trim()) params.set('subject', values.emailSubject.trim());
      if (values.emailBody.trim()) params.set('body', values.emailBody.trim());
      const query = params.toString();
      return {
        payload: `mailto:${to}${query ? `?${query}` : ''}`,
        label: to,
      };
    }
    case 'phone': {
      const phone = values.phone.trim();
      const digits = phone.replace(/[^\d+]/g, '');
      if (digits.length < 5) {
        return { payload: '', label: '', error: 'Enter a valid phone number.' };
      }
      return {
        payload: `tel:${digits}`,
        label: phone,
      };
    }
    case 'wifi': {
      const ssid = values.wifiSsid.trim();
      if (!ssid) return { payload: '', label: '', error: 'Enter the Wi-Fi network name (SSID).' };
      if (values.wifiEncryption !== 'nopass' && !values.wifiPassword) {
        return { payload: '', label: '', error: 'Enter a Wi-Fi password or select Open Network.' };
      }
      const parts = [
        `T:${values.wifiEncryption}`,
        `S:${escapeWifiField(ssid)}`,
        values.wifiEncryption !== 'nopass' ? `P:${escapeWifiField(values.wifiPassword)}` : '',
        values.wifiHidden ? 'H:true' : '',
      ].filter(Boolean);
      return {
        payload: `WIFI:${parts.join(';')};;`,
        label: `Wi-Fi · ${ssid}`,
      };
    }
    case 'contact': {
      const name = values.contactName.trim();
      if (!name) return { payload: '', label: '', error: 'Enter a contact name.' };
      if (values.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())) {
        return { payload: '', label: '', error: 'Enter a valid contact email address.' };
      }
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${name}`,
        `N:${name};;;`,
        values.contactOrg.trim() ? `ORG:${values.contactOrg.trim()}` : '',
        values.contactPhone.trim() ? `TEL;TYPE=CELL:${values.contactPhone.trim()}` : '',
        values.contactEmail.trim() ? `EMAIL:${values.contactEmail.trim()}` : '',
        values.contactUrl.trim() ? `URL:${values.contactUrl.trim()}` : '',
        'END:VCARD',
      ].filter(Boolean);
      return {
        payload: lines.join('\n'),
        label: name,
      };
    }
  }
}
