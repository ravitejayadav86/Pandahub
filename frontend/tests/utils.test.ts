import { describe, expect, it } from "vitest";
import { cn } from "../src/lib/utils";

describe("shared class-name utility", () => {
  it("combines conditional classes", () => {
    expect(cn("px-2", false && "hidden", "text-sm")).toBe("px-2 text-sm");
  });

  it("resolves conflicting Tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles empty inputs without fabricating a class name", () => {
    expect(cn(undefined, null, false)).toBe("");
  });
});
