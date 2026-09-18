import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/common/PageHeader";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

describe("PageHeader", () => {
  it("renders title and description", () => {
    render(
      <PageHeader title="Overview" description="Restaurant queue snapshot" />,
    );

    expect(
      screen.getByRole("heading", { name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Restaurant queue snapshot")).toBeInTheDocument();
  });

  it("renders breadcrumbs when provided", () => {
    render(
      <PageHeader
        title="Restaurant"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard/overview" },
          { label: "Settings", href: "/settings" },
          { label: "Restaurant" },
        ]}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard/overview",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });
});

describe("Breadcrumbs", () => {
  it("marks the last item as the current page", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Branches" },
        ]}
      />,
    );

    expect(screen.getByText("Branches")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
