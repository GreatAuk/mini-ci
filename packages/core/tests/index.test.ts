import { describe, expect, test } from "vitest";
import { supportedOperations, supportedPlatforms } from "../src/index";

describe("core public api", () => {
  test("exports supported operations", () => {
    expect(supportedOperations).toEqual(["open", "preview", "upload"]);
  });

  test("exports supported platforms", () => {
    expect(supportedPlatforms).toEqual([
      "mp-weixin",
      "mp-alipay",
      "mp-baidu",
      "mp-jd",
      "mp-toutiao",
    ]);
  });
});
