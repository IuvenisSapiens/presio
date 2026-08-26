import { test, expect } from "@playwright/test";

// Regression test: the login dialog opened from the home page nav used to
// collapse to the nav's box. The nav has backdrop-blur, and an ancestor with a
// backdrop-filter becomes the containing block for fixed descendants, so the
// overlay's `fixed inset-0` resolved against the ~64px nav instead of the
// viewport. DialogOverlay now portals to <body>, which this asserts.

test("login dialog covers the viewport and dims/blurs the page", async ({ page }) => {
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "Log in", exact: true }).click();

  // The login dialog's DialogOverlay wrapper (scoped via its email input so we
  // don't match other fixed overlays on the page).
  const overlay = page.locator("div.fixed.inset-0.z-50", { has: page.locator('input[type="email"]') });
  await expect(overlay).toBeVisible();

  // Covers the whole viewport, so the card is centered and nothing outside is
  // clickable/selectable through.
  const vp = page.viewportSize()!;
  const box = await overlay.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(vp.width * 0.99);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(vp.height * 0.99);

  // Dim + blur over the whole page.
  const styles = await overlay.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { backdropFilter: cs.backdropFilter, backgroundColor: cs.backgroundColor };
  });
  expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.backdropFilter).not.toBe("none");

  // Background content must be behind the overlay, not hit-testable.
  const heroHit = await page.evaluate(() => {
    const h1 = document.querySelector(".home2 h1");
    if (!h1) return null;
    const r = h1.getBoundingClientRect();
    return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("div.fixed.inset-0");
  });
  expect(heroHit).toBe(true);
});
