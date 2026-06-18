import { describe, expect, it } from "vitest";

import { filterOwnedAgentImagePaths } from "@/features/agents/runs/schema";

// Guards the cross-tenant IDOR fix: resolveAgentImageUrlsAction signs only the
// paths this helper returns, so it must never let a path from another brand
// through. Agent images live at `${brandId}/${runId}/${index}.png`.
describe("filterOwnedAgentImagePaths", () => {
  const brandA = "11111111-1111-1111-1111-111111111111";
  const brandB = "22222222-2222-2222-2222-222222222222";

  it("keeps only paths under the caller's own brand", () => {
    const result = filterOwnedAgentImagePaths(
      [
        `${brandA}/run-1/0.png`,
        `${brandB}/run-9/0.png`, // another brand — must be dropped
        `${brandA}/run-1/1.png`,
      ],
      brandA,
    );

    expect(result).toEqual([`${brandA}/run-1/0.png`, `${brandA}/run-1/1.png`]);
  });

  it("returns nothing when the caller has no resolved brand", () => {
    expect(filterOwnedAgentImagePaths([`${brandA}/run-1/0.png`], null)).toEqual(
      [],
    );
  });

  it("rejects traversal and prefix look-alikes", () => {
    expect(
      filterOwnedAgentImagePaths(
        [
          `../${brandB}/run-1/0.png`,
          `${brandA}-evil/run-1/0.png`,
          `${brandA}extra/run-1/0.png`,
          "0.png", // no brand segment
        ],
        brandA,
      ),
    ).toEqual([]);
  });

  it("caps the number of returned paths at the limit", () => {
    const paths = Array.from(
      { length: 12 },
      (_, i) => `${brandA}/run-1/${i}.png`,
    );
    expect(filterOwnedAgentImagePaths(paths, brandA)).toHaveLength(8);
    expect(filterOwnedAgentImagePaths(paths, brandA, 3)).toHaveLength(3);
  });
});
