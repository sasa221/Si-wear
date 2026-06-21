import {
  SUPABASE_NOT_CONNECTED_MESSAGE,
  supabaseConfigured,
  useDevOrderMock,
} from "./supabase";
import { adminApiFetchJson, apiFetchJson } from "./apiClient";
import type { ShippingFeeQuote, ShippingZone } from "./types";

export const MANUAL_SHIPPING_MESSAGE = "Delivery fee will be confirmed by customer support.";

export const EGYPT_GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "Dakahlia",
  "Red Sea",
  "Beheira",
  "Fayoum",
  "Gharbia",
  "Ismailia",
  "Menofia",
  "Minya",
  "Qalyubia",
  "New Valley",
  "Suez",
  "Aswan",
  "Assiut",
  "Beni Suef",
  "Port Said",
  "Damietta",
  "Sharkia",
  "South Sinai",
  "Kafr El-Sheikh",
  "Matrouh",
  "Luxor",
  "Qena",
  "North Sinai",
  "Sohag",
];

export const ADMIN_GOVERNORATES = [...EGYPT_GOVERNORATES, "Other governorates"];

const SHIPPING_ZONES_KEY = "swear_shipping_zones";

type ShippingZoneRow = {
  id: string;
  governorate: string;
  city_area: string | null;
  delivery_fee_egp: number;
  free_shipping_min_egp: number | null;
  active: boolean;
  created_at: string;
};

type ShippingZonesPayload = {
  zones?: ShippingZoneRow[];
};

export type ShippingZoneInput = {
  id?: string;
  governorate: string;
  cityArea?: string;
  deliveryFeeEgp: number;
  freeShippingMinEgp?: number | null;
  active: boolean;
};

const DEFAULT_SHIPPING_ZONES: ShippingZone[] = [
  {
    id: "dev-zone-giza-hadayek",
    governorate: "Giza",
    cityArea: "Hadayek Al Ahram",
    deliveryFeeEgp: 40,
    freeShippingMinEgp: null,
    active: true,
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "dev-zone-giza-default",
    governorate: "Giza",
    deliveryFeeEgp: 60,
    freeShippingMinEgp: null,
    active: true,
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "dev-zone-cairo-default",
    governorate: "Cairo",
    deliveryFeeEgp: 70,
    freeShippingMinEgp: null,
    active: true,
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "dev-zone-alex-default",
    governorate: "Alexandria",
    deliveryFeeEgp: 90,
    freeShippingMinEgp: null,
    active: true,
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "dev-zone-other-default",
    governorate: "Other governorates",
    deliveryFeeEgp: 100,
    freeShippingMinEgp: null,
    active: true,
    createdAt: new Date(0).toISOString(),
  },
];

function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `zone-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isDefaultZone(zone: ShippingZone): boolean {
  return normalizeText(zone.cityArea) === "";
}

function isOtherGovernoratesZone(zone: ShippingZone): boolean {
  return normalizeText(zone.governorate) === "other governorates";
}

function rowToZone(row: ShippingZoneRow): ShippingZone {
  return {
    id: row.id,
    governorate: row.governorate,
    cityArea: row.city_area ?? undefined,
    deliveryFeeEgp: row.delivery_fee_egp,
    freeShippingMinEgp: row.free_shipping_min_egp,
    active: row.active,
    createdAt: row.created_at,
  };
}

function zoneToRow(zone: ShippingZoneInput): Record<string, unknown> {
  return {
    governorate: zone.governorate.trim(),
    city_area: zone.cityArea?.trim() || null,
    delivery_fee_egp: Math.max(0, Math.round(zone.deliveryFeeEgp)),
    free_shipping_min_egp:
      zone.freeShippingMinEgp === null || zone.freeShippingMinEgp === undefined
        ? null
        : Math.max(0, Math.round(zone.freeShippingMinEgp)),
    active: zone.active,
  };
}

function readLocalZones(): ShippingZone[] {
  try {
    const raw = localStorage.getItem(SHIPPING_ZONES_KEY);
    if (!raw) {
      localStorage.setItem(SHIPPING_ZONES_KEY, JSON.stringify(DEFAULT_SHIPPING_ZONES));
      return DEFAULT_SHIPPING_ZONES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SHIPPING_ZONES;
  } catch {
    return DEFAULT_SHIPPING_ZONES;
  }
}

function writeLocalZones(zones: ShippingZone[]): void {
  localStorage.setItem(SHIPPING_ZONES_KEY, JSON.stringify(zones));
}

function shouldUseLocalShipping(): boolean {
  if (supabaseConfigured) return false;
  if (useDevOrderMock) return true;
  throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
}

export async function getShippingZones(includeInactive = false): Promise<ShippingZone[]> {
  if (shouldUseLocalShipping()) {
    const zones = readLocalZones();
    return includeInactive ? zones : zones.filter(zone => zone.active);
  }

  const payload = includeInactive
    ? await adminApiFetchJson<ShippingZonesPayload>("/admin/shipping-zones", {}, "Failed to load shipping zones.")
    : await apiFetchJson<ShippingZonesPayload>("/shipping-zones", {}, "Failed to load shipping zones.");
  const zones = (payload.zones ?? []).map(rowToZone);
  return includeInactive ? zones : zones.filter(zone => zone.active);
}

export async function saveShippingZone(input: ShippingZoneInput): Promise<ShippingZone> {
  const id = input.id || createId();
  const now = new Date().toISOString();

  if (shouldUseLocalShipping()) {
    const zones = readLocalZones();
    const nextZone: ShippingZone = {
      id,
      governorate: input.governorate.trim(),
      cityArea: input.cityArea?.trim() || undefined,
      deliveryFeeEgp: Math.max(0, Math.round(input.deliveryFeeEgp)),
      freeShippingMinEgp:
        input.freeShippingMinEgp === null || input.freeShippingMinEgp === undefined
          ? null
          : Math.max(0, Math.round(input.freeShippingMinEgp)),
      active: input.active,
      createdAt: zones.find(zone => zone.id === id)?.createdAt || now,
    };
    const index = zones.findIndex(zone => zone.id === id);
    const nextZones = index === -1
      ? [nextZone, ...zones]
      : zones.map(zone => zone.id === id ? nextZone : zone);
    writeLocalZones(nextZones);
    return nextZone;
  }

  const body = JSON.stringify(zoneToRow(input));
  const payload = input.id
    ? await adminApiFetchJson<{ zone?: ShippingZoneRow }>(
        `/admin/shipping-zones/${encodeURIComponent(input.id)}`,
        { method: "PATCH", body },
        "Failed to update shipping zone."
      )
    : await adminApiFetchJson<{ zone?: ShippingZoneRow }>(
        "/admin/shipping-zones",
        {
          method: "POST",
          body: JSON.stringify({ id, ...zoneToRow(input), created_at: now }),
        },
        "Failed to save shipping zone."
      );

  if (!payload.zone) throw new Error("Shipping API did not return a zone.");
  return rowToZone(payload.zone);
}

function applyFreeShipping(zone: ShippingZone, subtotalEgp: number): number {
  const minimum = zone.freeShippingMinEgp;
  if (minimum !== null && minimum !== undefined && minimum > 0 && subtotalEgp >= minimum) {
    return 0;
  }
  return zone.deliveryFeeEgp;
}

export function getShippingFeeQuote(
  zones: ShippingZone[],
  governorate: string,
  cityArea: string,
  subtotalEgp: number
): ShippingFeeQuote {
  const activeZones = zones.filter(zone => zone.active);
  const gov = normalizeText(governorate);
  const city = normalizeText(cityArea);

  if (!gov) {
    return { matched: false, fee: null, message: "Select a governorate to calculate delivery." };
  }

  const exactMatch = city
    ? activeZones.find(zone =>
        normalizeText(zone.governorate) === gov &&
        normalizeText(zone.cityArea) === city
      )
    : undefined;

  const governorateDefault = activeZones.find(zone =>
    normalizeText(zone.governorate) === gov &&
    isDefaultZone(zone)
  );

  const hasGovernorateZone = zones.some(zone => normalizeText(zone.governorate) === gov);
  const otherGovernoratesDefault = hasGovernorateZone
    ? undefined
    : activeZones.find(zone =>
        isOtherGovernoratesZone(zone) &&
        isDefaultZone(zone)
      );

  const zone = exactMatch || governorateDefault || otherGovernoratesDefault;
  if (!zone) return { matched: false, fee: null, message: MANUAL_SHIPPING_MESSAGE };

  return {
    matched: true,
    fee: applyFreeShipping(zone, subtotalEgp),
    zone,
  };
}
