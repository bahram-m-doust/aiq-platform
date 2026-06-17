import { describe, expect, it } from "vitest";

import { notificationAudienceFilter } from "@/features/notifications/schema";

const PROFILE = "11111111-1111-4111-8111-111111111111";
const BRAND = "22222222-2222-4222-8222-222222222222";

describe("notificationAudienceFilter", () => {
  it("scopes brand members to their own brand and never adds the team inbox", () => {
    const filter = notificationAudienceFilter(PROFILE, "REGISTERED_USER", BRAND);

    expect(filter).toContain(`recipient_id.eq.${PROFILE}`);
    expect(filter).toContain(`and(audience.eq.CLIENT,brand_id.eq.${BRAND})`);
    expect(filter).not.toContain("INTERNAL_TEAM");
  });

  it("gives internal roles the cross-brand team inbox in the admin shell", () => {
    const filter = notificationAudienceFilter(PROFILE, "PLATFORM_OWNER", BRAND);

    expect(filter).toContain("audience.eq.INTERNAL_TEAM");
  });

  // The leak fix: inside a brand's client workspace the cross-brand team inbox
  // must be excluded even for an internal/platform-owner role, so one brand's
  // bell never surfaces (or deep-links into) another brand's notifications.
  it("excludes the team inbox in a brand workspace even for a platform owner", () => {
    const filter = notificationAudienceFilter(PROFILE, "PLATFORM_OWNER", BRAND, {
      includeInternalTeamInbox: false,
    });

    expect(filter).not.toContain("INTERNAL_TEAM");
    expect(filter).toContain(`recipient_id.eq.${PROFILE}`);
    expect(filter).toContain(`and(audience.eq.CLIENT,brand_id.eq.${BRAND})`);
  });

  it("rejects a non-UUID profile id so it can't smuggle filter clauses", () => {
    expect(() =>
      notificationAudienceFilter("not-a-uuid", "PLATFORM_OWNER", BRAND),
    ).toThrow();
  });
});
