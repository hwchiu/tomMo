import { expect, test, type Page } from "@playwright/test";
import { adminPassword, viewerPassword } from "./passwords.mjs";

async function login(page: Page, username: string, password: string) {
  await page.goto("/login/");
  await page.getByLabel("帳號").fill(username);
  await page.getByLabel("密碼").fill(password);
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page.getByRole("link", { name: "總覽" }).first()).toBeVisible();
}

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
  await expect(page.getByText("廠區 TPM")).toBeVisible();
  await expect(page.getByText("林品均").first()).toBeVisible();
  await expect(page.getByText("計畫機台合計")).toBeVisible();
  await expect(page.getByText("高壓電契約容量不足").first()).toBeVisible();

  await page.locator("#plans").getByRole("link", { name: "運算產品 Compute" }).click();
  await expect(page).toHaveURL(/\/plans\//);
  await expect(page.getByRole("heading", { name: "計畫機台" })).toBeVisible();
  const machine = page.getByLabel("EIA-1");
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

test("delivery status filters 對外 and issues omit priority", async ({ page }) => {
  await login(page, "admin", adminPassword);
  await page.locator("aside").getByRole("link", { name: "產品交付狀況" }).click();
  await expect(page.getByRole("heading", { name: "產品交付狀況" })).toBeVisible();
  await expect(page.getByText("運算產品 Compute").first()).toBeVisible();
  await expect(page.getByText("開發產品 Developer").first()).toBeVisible();
  await page.getByLabel("可見範圍").selectOption("EXTERNAL");
  await expect(page.getByText("運算產品 Compute").first()).toBeVisible();
  await expect(page.getByText("開發產品 Developer")).toHaveCount(0);
  await page.getByLabel("可見範圍").selectOption("INTERNAL");
  await expect(page.getByText("開發產品 Developer").first()).toBeVisible();
  await expect(page.getByText("運算產品 Compute")).toHaveCount(0);

  await page.goto("/issues/new/");
  await expect(page.getByLabel("優先序")).toHaveCount(0);
  await expect(page.getByLabel("產品").locator("option", { hasText: "其他" })).toHaveCount(1);
});

test("editor nav includes 管理 before bootstrap returns", async ({ page }) => {
  await login(page, "admin", adminPassword);
  await page.route("**/api/v1/bootstrap", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  await page.reload();
  await expect(page.locator("aside").getByRole("link", { name: "管理" })).toBeVisible({ timeout: 2000 });
  await page.unroute("**/api/v1/bootstrap");
});

test("viewer nav never shows 管理", async ({ page }) => {
  await login(page, "viewer", viewerPassword);
  await expect(page.locator("aside").getByRole("link", { name: "管理" })).toHaveCount(0);
  await page.route("**/api/v1/bootstrap", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.reload();
  await expect(page.locator("aside").getByRole("link", { name: "管理" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "總覽" }).first()).toBeVisible();
  await expect(page.locator("aside").getByRole("link", { name: "管理" })).toHaveCount(0);
});

test("machine type names are English", async ({ page }) => {
  await login(page, "admin", adminPassword);
  await page.goto("/admin/?section=machines");
  await expect(page.getByRole("heading", { name: "機器設定" })).toBeVisible();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "新增機種" }) });
  await form.getByLabel("名稱").fill("機種中文");
  await form.getByRole("button", { name: "新增機種" }).click();
  await expect(page.getByText("機種名稱只能使用英文、數字與 - _ . 空格")).toBeVisible();
  await form.getByLabel("名稱").fill("EIA-9");
  await form.getByRole("button", { name: "新增機種" }).click();
  await expect(page.getByText("已新增機種")).toBeVisible();
  await expect(page.locator('input[value="EIA-9"]')).toBeVisible();
});
