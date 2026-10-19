import { expect, test, type Page } from "@playwright/test";
import { adminPassword, viewerPassword } from "./passwords.mjs";

async function login(page: Page, username: string, password: string) {
  await page.goto("/login/");
  await page.getByLabel("帳號").fill(username);
  await page.getByLabel("密碼").fill(password);
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page.getByRole("link", { name: "總覽" }).first()).toBeVisible();
}

test("a delayed delivery cell shows its reason", async ({ page }) => {
  await login(page, "admin", adminPassword);
  await page.locator("aside").getByRole("link", { name: /產品交付狀況/ }).click();
  await expect(page).toHaveURL(/\/product-build\/?$/);
  await expect(page.getByRole("heading", { name: "產品交付狀況" })).toBeVisible();
  await expect(page.locator("#delay-legend").getByText("施工計畫未提交", { exact: true })).toBeVisible();
  const cell = page.locator("[data-delay-cell='新竹一廠:開發產品 Developer']").first();
  await cell.scrollIntoViewIfNeeded();
  await expect(cell.getByText("施工計畫未提交")).toBeVisible();
  await expect(cell.getByText("延遲", { exact: true }).first()).toBeVisible();
  await page.getByLabel("延遲理由").selectOption({ label: "施工計畫未提交" });
  await expect(page).toHaveURL(/reason=PLAN_NOT_SUBMITTED/);
  await expect(cell.getByText("施工計畫未提交")).toBeVisible();
});

test("a month filter keeps factories that have work in October", async ({ page }) => {
  await login(page, "admin", adminPassword);
  await page.goto("/product-build/");
  await page.getByLabel("時程月份").fill("2026-10");
  await expect(page).toHaveURL(/from=2026-10-01/);
  await expect(page).toHaveURL(/to=2026-10-31/);
  await expect(page.locator("#schedule-range")).toHaveText("時程 2026-10-01 – 2026-10-31");
  await expect(page.getByRole("link", { name: "新竹一廠" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "新竹二廠" })).toHaveCount(0);
  await page.locator("aside").getByRole("link", { name: /產品版本管理/ }).click();
  await expect(page).toHaveURL(/\/product-versions\/?$/);
  await expect(page.getByRole("heading", { name: "產品版本管理" })).toBeVisible();
  await page.getByLabel("時程月份").fill("2026-10");
  await expect(page).toHaveURL(/from=2026-10-01/);
  await expect(page.locator("tbody").getByText("新竹一廠", { exact: true }).first()).toBeVisible();
  await expect(page.locator("tbody").getByText("新竹二廠")).toHaveCount(0);
  await page.goto("/capabilities/?from=2026-10-01&to=2026-10-31");
  await expect(page).toHaveURL(/\/product-versions\/?/);
  await expect(page).toHaveURL(/from=2026-10-01/);
  await expect(page.getByRole("heading", { name: "產品版本管理" })).toBeVisible();
  await expect(page.locator("#schedule-range")).toHaveText("時程 2026-10-01 – 2026-10-31");
});

test("rejects a wrong password and hides the demo hint", async ({ page }) => {
  await page.goto("/login/");
  await expect(page.getByText("示範帳號")).toHaveCount(0);
  await page.getByLabel("帳號").fill("admin");
  await page.getByLabel("密碼").fill("not-the-password");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page.getByText("帳號或密碼不正確")).toBeVisible();
});

test("editor and viewer walk the imported factory", async ({ page }) => {
  await login(page, "admin", adminPassword);
  await expect(page.getByText(/年\d+月/).first()).toBeVisible();

  await page.locator("aside").getByRole("link", { name: /^工廠/ }).click();
  await expect(page).toHaveURL(/\/factories\/?$/);
  const factoryLink = page.getByRole("link", { name: "新竹一廠", exact: true });
  await expect(factoryLink).toBeVisible();
  await factoryLink.click();
  await expect(page.getByText("廠區 PM")).toBeVisible();
  await expect(page.getByText("林品均").first()).toBeVisible();
  await expect(page.getByText("計畫機台合計")).toBeVisible();
  await expect(page.getByText("高壓電契約容量不足").first()).toBeVisible();

  await page.locator("#plans").getByRole("link", { name: "運算產品 Compute" }).click();
  await expect(page).toHaveURL(/\/plans\//);
  await expect(page.getByRole("heading", { name: "計畫機台" })).toBeVisible();
  const machine = page.getByLabel("機種A");
  await machine.fill("10");
  await expect(page.getByText(/合計 \d+ 台/)).toBeVisible();
  await page.getByLabel("預計施工結束").fill("2026-12-20");
  await expect(page.getByText("此時程超出階段")).toBeVisible();
  await page.getByRole("button", { name: "新增功能覆寫" }).click();
  await page.getByRole("button", { name: "儲存草稿" }).click();
  await expect(page.getByText("草稿已儲存")).toBeVisible();

  await page.locator("aside").getByRole("link", { name: /^工廠/ }).click();
  await page.getByRole("link", { name: "新竹一廠", exact: true }).click();
  await page.locator("#topics").getByRole("button", { name: "新增" }).click();
  await page.locator("#topics").getByLabel("標題").fill("測試議題");
  await page.locator("#topics").getByRole("button", { name: "儲存" }).click();
  await expect(page.getByText("已新增例外事項")).toBeVisible();
  await expect(page.getByText("測試議題", { exact: true })).toBeVisible();

  await page.goto("/products/new/");
  await expect(page.getByLabel("代碼")).toHaveCount(0);
  await expect(page.getByLabel("名稱")).toBeVisible();
  await expect(page.getByLabel("開發部門")).toBeVisible();
  await expect(page.getByLabel("專案部門")).toBeVisible();
  await expect(page.getByLabel("主責")).toBeVisible();
  await expect(page.getByLabel("版本模式")).toBeVisible();
  await page.getByLabel("名稱").fill("測試產品甲");
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByRole("heading", { name: "測試產品甲" })).toBeVisible();

  await page.goto("/admin/");
  const createPerson = page.locator("form").filter({ has: page.getByRole("button", { name: "新增" }) });
  await createPerson.getByLabel("姓名").fill("測試員甲");
  await createPerson.getByLabel("部門").fill("品管處");
  await createPerson.getByRole("button", { name: "新增" }).click();
  await expect(page.getByText("已新增人員")).toBeVisible();
  await expect.poll(async () => page.locator("input").evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value))).toContain("測試員甲");

  await page.getByRole("button", { name: "登出" }).click();
  await expect(page.getByRole("heading", { name: "登入廠務協調台" })).toBeVisible();

  await login(page, "viewer", viewerPassword);
  await page.goto("/admin/");
  await expect(page.getByText("使用者只能閱讀人員目錄。")).toBeVisible();
  await expect(page.getByRole("heading", { name: "新增人員" })).toHaveCount(0);
  await page.goto("/products/");
  await expect(page.getByRole("link", { name: "新增產品" })).toHaveCount(0);
  await page.goto("/factories/");
  await page.getByRole("link", { name: "新竹一廠", exact: true }).click();
  await page.locator("#plans").getByRole("link", { name: "運算產品 Compute" }).click();
  await expect(page.getByRole("button", { name: "儲存草稿" })).toBeDisabled();
  const denied = await page.request.post("/api/v1/people", { data: { name: "不行", department: "廠務處" } });
  expect(denied.status()).toBe(403);
  expect(await denied.json()).toMatchObject({ message: "使用者只能閱讀" });
});
