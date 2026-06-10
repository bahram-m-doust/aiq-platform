import { ROUTES } from "@/lib/routes";

// The brand-as-city model districts — a single source of truth shared by the
// city grid, the per-district pages, the admin upload board and the backend.
// `key` is the stable identifier stored in the DB; `slug` is the URL segment.
export type CityModelDistrict = {
  key: string;
  slug: string;
  name: string;
  description: string;
};

export const CITY_MODEL_DISTRICTS: readonly CityModelDistrict[] = [
  {
    key: "PURPOSE_FORM",
    slug: "purpose-form",
    name: "Purpose & Form",
    description: "Why the brand exists and the shape it takes in the city.",
  },
  {
    key: "SUCCESS_METRICS",
    slug: "success-metrics",
    name: "Success Metrics",
    description: "How the brand knows it is winning.",
  },
  {
    key: "BARRIERS",
    slug: "barriers",
    name: "Barriers",
    description: "What stands in the way of the brand's growth.",
  },
  {
    key: "COMPLEMENTARY_ROLES",
    slug: "complementary-roles",
    name: "Complementary Roles",
    description: "The partners and roles that complete the brand.",
  },
  {
    key: "PERSONA",
    slug: "persona",
    name: "Persona",
    description: "Who the brand is — its character and traits.",
  },
  {
    key: "RITUALS",
    slug: "rituals",
    name: "Rituals",
    description: "The repeated behaviours that define the brand.",
  },
  {
    key: "DAY_IN_THE_LIFE",
    slug: "day-in-the-life",
    name: "A Day in the Life",
    description: "A day experienced through the brand.",
  },
  {
    key: "SHARED_EXPERIENCES",
    slug: "shared-experiences",
    name: "Shared Experiences",
    description: "The moments the brand creates with its people.",
  },
  {
    key: "ATTRACTION_EXIT",
    slug: "attraction-exit",
    name: "Attraction & Exit",
    description: "How people enter and leave the brand's world.",
  },
  {
    key: "BRAND",
    slug: "brand",
    name: "Brand",
    description: "The name, voice and signature of the brand.",
  },
  {
    key: "TOUCHPOINTS",
    slug: "touchpoints",
    name: "Touchpoints",
    description: "The high-traffic places the brand is met.",
  },
  {
    key: "STRATEGIC_RESOURCES",
    slug: "strategic-resources",
    name: "Strategic Resources",
    description: "The assets the brand builds on.",
  },
  {
    key: "REVENUE_MODEL",
    slug: "revenue-model",
    name: "Revenue Model",
    description: "How the brand sustains itself.",
  },
] as const;

export function cityModelDistrictPath(slug: string): string {
  return `${ROUTES.brainRoadmapCityModel}/${slug}`;
}

export function getCityModelDistrictBySlug(
  slug: string,
): CityModelDistrict | null {
  return CITY_MODEL_DISTRICTS.find((district) => district.slug === slug) ?? null;
}

export function getCityModelDistrictByKey(
  key: string,
): CityModelDistrict | null {
  return CITY_MODEL_DISTRICTS.find((district) => district.key === key) ?? null;
}

export function isCityModelDistrictKey(key: string): boolean {
  return CITY_MODEL_DISTRICTS.some((district) => district.key === key);
}
