import {
  SUPABASE_NOT_CONNECTED_MESSAGE,
  getSupabaseAccessToken,
  supabaseConfigured,
  useDevOrderMock,
} from "@/lib/supabase";
import { apiUrl } from "@/lib/apiConfig";

const SETTINGS_KEY = "swear_store_settings";

export interface StoreSettings {
  brandName: string;
  whatsappNumber: string;
  announcementBarText: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  storeLocation: string;
  shippingNote: string;
  returnsPolicyText: string;
  supportInfo: string;
}

export const defaultStoreSettings: StoreSettings = {
  brandName: "S! Wear",
  whatsappNumber: "201220172714",
  announcementBarText: "",
  instagramUrl: "",
  tiktokUrl: "",
  facebookUrl: "",
  storeLocation: "Gate 1, 113D Pyramids Gardens, Giza, Egypt",
  shippingNote: "Delivery fee is calculated by governorate and city/area at checkout.",
  returnsPolicyText: "7-day exchange policy for delivered orders.",
  supportInfo: "+20 122 017 2714",
};

type StoreSettingsRow = {
  brand_name?: string;
  whatsapp_number?: string;
  announcement_bar_text?: string;
  announcement_text?: string | null;
  instagram_url?: string;
  tiktok_url?: string;
  facebook_url?: string;
  store_location?: string;
  shipping_note?: string;
  default_shipping_note?: string | null;
  free_shipping_message?: string | null;
  returns_policy_text?: string;
  support_info?: string;
  contact_phone?: string | null;
};

type SettingsApiPayload = {
  ok?: boolean;
  settings?: StoreSettingsRow;
  message?: string;
  error?: string;
};

function rowToSettings(row: StoreSettingsRow | undefined): StoreSettings {
  return {
    brandName: row?.brand_name || defaultStoreSettings.brandName,
    whatsappNumber: row?.whatsapp_number || defaultStoreSettings.whatsappNumber,
    announcementBarText: row?.announcement_bar_text || row?.announcement_text || "",
    instagramUrl: row?.instagram_url || "",
    tiktokUrl: row?.tiktok_url || "",
    facebookUrl: row?.facebook_url || "",
    storeLocation: row?.store_location || defaultStoreSettings.storeLocation,
    shippingNote: row?.shipping_note || row?.default_shipping_note || row?.free_shipping_message || defaultStoreSettings.shippingNote,
    returnsPolicyText: row?.returns_policy_text || defaultStoreSettings.returnsPolicyText,
    supportInfo: row?.support_info || row?.contact_phone || defaultStoreSettings.supportInfo,
  };
}

function settingsToRow(settings: StoreSettings): StoreSettingsRow {
  return {
    brand_name: settings.brandName,
    whatsapp_number: settings.whatsappNumber.replace(/[^\d]/g, ""),
    announcement_bar_text: settings.announcementBarText,
    instagram_url: settings.instagramUrl,
    tiktok_url: settings.tiktokUrl,
    facebook_url: settings.facebookUrl,
    store_location: settings.storeLocation,
    shipping_note: settings.shippingNote,
    returns_policy_text: settings.returnsPolicyText,
    support_info: settings.supportInfo,
  };
}

function readLocalSettings(): StoreSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...defaultStoreSettings, ...JSON.parse(stored) } : defaultStoreSettings;
  } catch {
    return defaultStoreSettings;
  }
}

function writeLocalSettings(settings: StoreSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function readApiPayload(res: Response): Promise<SettingsApiPayload> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) as SettingsApiPayload : {};
  } catch {
    return { message: text };
  }
}

function apiMessage(payload: SettingsApiPayload, fallback: string): string {
  return typeof payload.message === "string" && payload.message
    ? payload.message
    : typeof payload.error === "string" && payload.error
      ? payload.error
      : fallback;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!supabaseConfigured) {
    if (useDevOrderMock) return readLocalSettings();
    throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl("/settings"));
  } catch {
    throw new Error("Settings API is not reachable. Start the API server and try again.");
  }
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(apiMessage(payload, "Failed to load settings."));
  }
  return rowToSettings(payload.settings);
}

export async function saveStoreSettings(settings: StoreSettings): Promise<StoreSettings> {
  if (!supabaseConfigured) {
    if (!useDevOrderMock) throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
    writeLocalSettings(settings);
    return settings;
  }

  const token = getSupabaseAccessToken();
  if (!token) throw new Error("Admin login is required. Sign in again.");

  let response: Response;
  try {
    response = await fetch(apiUrl("/admin/settings"), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settingsToRow(settings)),
    });
  } catch {
    throw new Error("Settings API is not reachable. Start the API server and try again.");
  }
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(apiMessage(payload, "Failed to save settings."));
  }
  return rowToSettings(payload.settings);
}
