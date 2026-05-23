import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InactiveDashboardState } from "@/components/dashboard/InactiveDashboardState";

vi.mock("@/features/demo-requests/actions", () => ({
  createDemoRequestAction: vi.fn(async () => ({
    status: "idle",
    message: "",
  })),
}));

describe("inactive dashboard state", () => {
  it("renders activation copy, access key form, and a working Request Demo action", () => {
    render(
      <InactiveDashboardState
        email="owner@example.com"
        signOutAction={<button type="button">Sign out</button>}
      />,
    );

    expect(
      screen.getByText(
        "Your strategic workspace is ready, but not yet activated. Activate access to begin the Brand Intelligence process and start building your Brand Brain.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("form", { name: "Access Key activation" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Access Key")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Redeem Access Key" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Request Demo Access" }),
    ).toBeEnabled();

    expect(screen.queryByText(/intake/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/modules/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/agents/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^files/i)).not.toBeInTheDocument();
  });
});
