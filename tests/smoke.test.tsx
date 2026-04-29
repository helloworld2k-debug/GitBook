import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("test scaffold", () => {
  it("renders the generated home page", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /to get started, edit the page\.tsx file/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /documentation/i })).toHaveAttribute(
      "href",
      expect.stringContaining("nextjs.org/docs"),
    );
  });
});
