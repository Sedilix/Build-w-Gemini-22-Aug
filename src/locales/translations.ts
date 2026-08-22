/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Central localization dictionary for Senior SafeSpot Singapore.
 * Covers Singapore's 4 official languages: English, Mandarin Chinese (简体中文),
 * Bahasa Melayu, and Tamil (தமிழ்), with Singlish-friendly English phrasing.
 */

import { Language } from '../types';

export interface LanguageOption {
  id: Language;
  nativeName: string;
  englishName: string;
  flag: string;
  /** BCP-47 locale used for Web Speech synthesis of non-English readouts */
  speechLocale: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'en', nativeName: 'English', englishName: 'English', flag: '🇸🇬', speechLocale: 'en-SG' },
  { id: 'zh', nativeName: '中文', englishName: 'Mandarin', flag: '🇸🇬', speechLocale: 'zh-CN' },
  { id: 'ms', nativeName: 'Melayu', englishName: 'Malay', flag: '🇸🇬', speechLocale: 'ms-MY' },
  { id: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', flag: '🇸🇬', speechLocale: 'ta-IN' },
];

/**
 * Translation keys grouped by UI surface. Every key must have an `en` value;
 * missing keys in other languages fall back to English via `t()`.
 */
export const TRANSLATIONS: Record<string, Partial<Record<Language, string>>> = {
  // ── Header / Accessibility bar ──────────────────────────────────────────
  'header.tagline': {
    en: 'Verified GPS • Google Street View AI • 1-Tap SG Family Alerts',
    zh: '已验证的GPS定位 • 街景AI比对 • 一键通知家人',
    ms: 'GPS Disahkan • AI Street View • Amaran Keluarga 1-Tap',
    ta: 'சரிபார்க்கப்பட்ட GPS • ஸ்ட்ரீட் வியூ AI • ஒரே தட்டலில் குடும்ப எச்சரிக்கை',
  },
  'header.voiceAssistant': {
    en: 'Voice Assistant',
    zh: '语音助手',
    ms: 'Pembantu Suara',
    ta: 'குரல் உதவியாளர்',
  },
  'header.voiceOn': {
    en: 'Voice On',
    zh: '语音开启',
    ms: 'Suara Hidup',
    ta: 'குரல் இயக்கம்',
  },
  'header.voiceOff': {
    en: 'Voice Off',
    zh: '语音关闭',
    ms: 'Suara Mati',
    ta: 'குரல் அணைப்பு',
  },
  'header.settings': {
    en: 'Settings',
    zh: '设置',
    ms: 'Tetapan',
    ta: 'அமைப்புகள்',
  },
  'header.contrast': {
    en: 'Contrast',
    zh: '高对比',
    ms: 'Kontras',
    ta: 'மாறுபாடு',
  },
  'header.signIn': {
    en: 'Sign In',
    zh: '登录',
    ms: 'Log Masuk',
    ta: 'உள்நுழைய',
  },
  'header.sos': {
    en: 'SOS 995',
    zh: '紧急 995',
    ms: 'SOS 995',
    ta: 'SOS 995',
  },
  'header.language': {
    en: 'Language',
    zh: '语言',
    ms: 'Bahasa',
    ta: 'மொழி',
  },

  // ── Live Location Card ──────────────────────────────────────────────────
  'live.readAddress': {
    en: 'Read Address Out Loud',
    zh: '大声读出地址',
    ms: 'Baca Alamat Dengan Kuat',
    ta: 'முகவரியை சத்தமாக படி',
  },
  'live.readingAddress': {
    en: 'Reading Address...',
    zh: '正在读出地址…',
    ms: 'Membaca Alamat...',
    ta: 'முகவரி படிக்கப்படுகிறது...',
  },
  'live.updateLocation': {
    en: 'Update My Location',
    zh: '更新我的位置',
    ms: 'Kemas Kini Lokasi Saya',
    ta: 'என் இடத்தை புதுப்பி',
  },
  'live.updatingLocation': {
    en: 'Refreshing GPS...',
    zh: '正在更新GPS…',
    ms: 'Memuat Semula GPS...',
    ta: 'GPS புதுப்பிக்கப்படுகிறது...',
  },

  // ── One-Tap Share Panel ─────────────────────────────────────────────────
  'share.title': {
    en: 'One-Tap Caregiver & Family Pickup',
    zh: '一键通知看护与家人来接',
    ms: 'Satu-Tap Penjaga & Keluarga',
    ta: 'ஒரே தட்டலில் பராமரிப்பாளர் & குடும்பம்',
  },
  'share.subtitle': {
    en: 'Tap any contact below to immediately send your exact verified location & photo',
    zh: '点选任何联系人，立即发送您已验证的位置和照片',
    ms: 'Ketik mana-mana kenalan untuk menghantar lokasi anda yang disahkan',
    ta: 'உங்கள் சரிபார்க்கப்பட்ட இடத்தை உடனடியாக அனுப்ப கீழே உள்ள தொடர்பை தட்டவும்',
  },
  'share.sendPin': {
    en: 'Send Pin',
    zh: '发送位置',
    ms: 'Hantar Pin',
    ta: 'இடத்தை அனுப்பு',
  },
  'share.call': {
    en: 'Call',
    zh: '打电话',
    ms: 'Panggil',
    ta: 'அழை',
  },
  'share.editContacts': {
    en: 'Edit Contacts',
    zh: '编辑联系人',
    ms: 'Sunting Kenalan',
    ta: 'தொடர்புகளை திருத்து',
  },
  'share.driverScreen': {
    en: 'Driver Screen',
    zh: '司机屏幕',
    ms: 'Skrin Pemandu',
    ta: 'ஓட்டுநர் திரை',
  },
  'share.alertFamily': {
    en: 'Alert Family & Live Track',
    zh: '通知家人并实时追踪',
    ms: 'Maklumkan Keluarga & Jejak Langsung',
    ta: 'குடும்பத்திற்கு எச்சரிக்கை & நேரடி கண்காணிப்பு',
  },
  'share.copyLink': {
    en: 'Copy Location Link',
    zh: '复制位置链接',
    ms: 'Salin Pautan Lokasi',
    ta: 'இட இணைப்பை நகலெடு',
  },
  'share.copied': {
    en: 'Link Copied!',
    zh: '链接已复制！',
    ms: 'Pautan Disalin!',
    ta: 'இணைப்பு நகலெடுக்கப்பட்டது!',
  },

  // ── Emergency SOS Banner ────────────────────────────────────────────────
  'sos.countdownTitle': {
    en: 'Emergency SCDF Dispatch in',
    zh: '紧急民防部队出动，倒计时',
    ms: 'Pasukan SCDF Kecemasan dalam',
    ta: 'அவசர SCDF அனுப்புகிறது',
  },
  'sos.countdownDesc': {
    en: 'Calling Singapore 995 (SCDF Ambulance) and dispatching live coordinates.',
    zh: '正在拨打新加坡995（民防救护车），并发送实时坐标。',
    ms: 'Memanggil 995 Singapura (Ambulans SCDF) dan menghantar koordinat langsung.',
    ta: 'சிங்கப்பூர் 995 (SCDF ஆம்புலன்ஸ்) அழைக்கப்பட்டு நேரடி ஆயத்தொலைவுகள் அனுப்பப்படுகின்றன.',
  },
  'sos.cancel': {
    en: 'Cancel Alert',
    zh: '取消警报',
    ms: 'Batal Amaran',
    ta: 'எச்சரிக்கையை ரத்து செய்',
  },

  // ── Fall Detection (P1 sensor) ──────────────────────────────────────────
  'fall.title': {
    en: 'Fall Detected. Are You Okay?',
    zh: '检测到跌倒。您还好吗？',
    ms: 'Jatuh Dikesan. Anda Okay?',
    ta: 'வீழ்ச்சி கண்டறியப்பட்டது. நீங்கள் நலமா?',
  },
  'fall.desc': {
    en: 'Tap the big button if you are safe. Emergency will call 995 automatically.',
    zh: '如果您平安，请按大按钮。否则将自动拨打995。',
    ms: 'Ketik butang jika anda selamat. Kecemasan akan hubungi 995 secara automatik.',
    ta: 'நீங்கள் பாதுகாப்பாக இருந்தால் பெரிய பொத்தானை அழுத்தவும். இல்லையெனில் 995 தானாக அழைக்கப்படும்.',
  },
  'fall.imOkay': {
    en: "I'M OKAY",
    zh: '我没事',
    ms: 'SAYA OKAY',
    ta: 'நான் நலம்',
  },

  // ── Caregiver Live Tracker (/track/:id) ─────────────────────────────────
  'tracker.title': {
    en: 'Live Senior Tracking',
    zh: '实时长辈追踪',
    ms: 'Penjejak Warga Emas Langsung',
    ta: 'மூத்தோர் நேரடி கண்காணிப்பு',
  },
  'tracker.battery': {
    en: 'Phone Battery',
    zh: '手机电量',
    ms: 'Bateri Telefon',
    ta: 'தொலைபேசி மின்கலம்',
  },
  'tracker.bloodType': {
    en: 'Blood Type',
    zh: '血型',
    ms: 'Jenis Darah',
    ta: 'இரத்த வகை',
  },
  'tracker.medicalNotes': {
    en: 'Medical Notes',
    zh: '医疗信息',
    ms: 'Nota Perubatan',
    ta: 'மருத்துவ குறிப்புகள்',
  },
  'tracker.landmarks': {
    en: 'Nearest Landmarks',
    zh: '附近地标',
    ms: 'Mercu Tanda Terdekat',
    ta: 'அருகிலுள்ள அடையாளங்கள்',
  },
  'tracker.lastUpdated': {
    en: 'Last updated',
    zh: '最后更新',
    ms: 'Terakhir dikemas kini',
    ta: 'கடைசியாக புதுப்பிக்கப்பட்டது',
  },
  'tracker.navigate': {
    en: 'Navigate',
    zh: '导航',
    ms: 'Navigasi',
    ta: 'வழிசெலுத்து',
  },
  'tracker.statusActive': {
    en: 'ACTIVE — Senior needs assistance',
    zh: '进行中 — 长辈需要帮助',
    ms: 'AKTIF — Warga emas perlukan bantuan',
    ta: 'செயலில் — மூத்தோருக்கு உதவி தேவை',
  },
  'tracker.statusResolved': {
    en: 'Resolved — Senior is safe',
    zh: '已解决 — 长辈平安',
    ms: 'Selesai — Warga emas selamat',
    ta: 'முடிந்தது — மூத்தோர் பாதுகாப்பு',
  },
  'tracker.notFound': {
    en: 'Tracking link not found or expired. Please ask your family member to resend the alert.',
    zh: '找不到追踪链接或已过期。请让家人重新发送警报。',
    ms: 'Pautan penjejakan tidak dijumpai. Sila minta ahli keluarga menghantar semula amaran.',
    ta: 'கண்காணிப்பு இணைப்பு கிடைக்கவில்லை. உங்கள் குடும்ப உறுப்பினரிடம் மீண்டும் அனுப்பச் சொல்லவும்.',
  },
};

/**
 * Translate a key into the given language, falling back to English.
 */
export function t(key: string, language: Language = 'en'): string {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  return entry[language] || entry.en || key;
}

/**
 * Returns the BCP-47 speech locale for Web Speech synthesis of a language.
 */
export function speechLocaleFor(language: Language): string {
  return LANGUAGE_OPTIONS.find((l) => l.id === language)?.speechLocale || 'en-SG';
}
