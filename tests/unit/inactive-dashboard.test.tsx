import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InactiveDashboardState } from "@/components/dashboard/InactiveDashboardState";

describe("inactive dashboard state", () => {
  it("renders activation copy, placeholders, and no product workflow links", () => {
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
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Contact Bextudio" }),
    ).toBeDisabled();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/intake/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/modules/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/agents/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/files/i)).not.toBeInTheDocument();
  });
});
