import type { ComponentProps, ReactNode } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  pathname: "/integrated-brand-brain/roadmap/questionnaire/company",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => routeState.pathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    ...props
  }: ComponentProps<"img"> & { src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} {...props} />
  ),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

import { Sidebar } from "@/components/app/Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const agents = [
  {
    key: "IMAGE_GENERATOR",
    name: "Image Generator",
    slug: "image-generator",
    state: "ACTIVE",
  },
  {
    key: "VIDEO_GENERATOR",
    name: "Video Generator",
    slug: "video-generator",
    state: "ACTIVE",
  },
];

function renderSidebar() {
  return render(
    <SidebarProvider>
      <Sidebar
        agents={agents}
        credits={0}
        email="parisa@example.com"
        fullName="Parisa"
        planName="Enterprise"
        role="OWNER"
      />
    </SidebarProvider>,
  );
}

describe("app sidebar", () => {
  beforeEach(() => {
    routeState.pathname = "/integrated-brand-brain/roadmap/questionnaire/company";
  });

  it("does not style an opened agents group as active outside agent pages", () => {
    renderSidebar();

    const agentsButton = screen.getByRole("button", { name: /Agents/ });
    fireEvent.click(agentsButton);

    expect(agentsButton).toHaveAttribute("data-state", "open");
    expect(agentsButton).toHaveAttribute("data-active", "false");
    expect(agentsButton.className).not.toContain(
      "data-[state=open]:text-primary",
    );
    expect(agentsButton.className).not.toContain("active:text-primary");
    expect(agentsButton.className).toContain("hover:bg-[#F0F0F0]");
    expect(agentsButton.className).toContain("data-[active=true]:bg-transparent");
    expect(
      screen.getByRole("link", { name: "Image Generator" }).className,
    ).not.toContain("active:text-primary");
    expect(
      screen.getByRole("link", { name: "Image Generator" }).className,
    ).toContain("hover:bg-[#F0F0F0]");
    expect(
      screen.getByRole("link", { name: "Image Generator" }).className,
    ).toContain("data-[active=true]:bg-[#F0F0F0]");
  });

  it("styles the agents group as active on an agent detail page", () => {
    routeState.pathname = "/agents/image-generator";

    renderSidebar();

    const agentsButton = screen.getByRole("button", { name: /Agents/ });
    expect(agentsButton).toHaveAttribute("data-active", "true");
    expect(agentsButton.className).toContain("data-[active=true]:bg-transparent");
    expect(agentsButton.className).not.toContain(
      "data-[active=true]:bg-[#F0F0F0]",
    );
    expect(screen.getByRole("link", { name: "Image Generator" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });
});
