import { describe, expect, it, vi } from "vitest";

const { custom, dismiss } = vi.hoisted(() => ({ custom: vi.fn(), dismiss: vi.fn() }));

vi.mock("sonner", () => ({ toast: { custom, dismiss } }));

import { notify } from "./notify";

describe("custom notifications", () => {
  it("routes a success operation through the branded notification presenter", () => {
    notify.success("Backup protected", "The selected file is encrypted.");
    expect(custom).toHaveBeenCalledWith(expect.any(Function), { duration: 4500 });
  });

  it("extends error visibility for actionable failure messages", () => {
    notify.error("Restore failed", "The historical snapshot could not be restored.");
    expect(custom).toHaveBeenLastCalledWith(expect.any(Function), { duration: 7000 });
  });
});
