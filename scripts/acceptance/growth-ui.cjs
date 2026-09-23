// Public browser/API boundary; use a disposable Compose database (changes its demo clock).
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const baseURL = process.argv[2] || "http://localhost:18090";
const screenshots = process.env.SCREENSHOT_DIR;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  page.on("pageerror", (error) => errors.push(error.message));
  const visible = async (locator) => {
    await locator.waitFor({ state: "visible" });
  };
  const tab = (name) =>
    page.getByRole("navigation").getByRole("button", { name, exact: true });
  const open = async (name) => {
    await tab(name).click();
    await page.getByRole("status").waitFor({ state: "hidden" });
  };
  const login = async (id) => {
    await page.getByRole("textbox", { name: "Поиск сотрудника" }).fill(id);
    await page.getByRole("button", { name: new RegExp(id) }).click();
    await visible(page.getByRole("button", { name: "Открыть Мой рост" }));
  };
  const screenshot = async (name) => {
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `No horizontal overflow: ${name}`,
    );
    for (const img of await page.locator("img").all()) {
      assert(
        await img.evaluate((node) => node.complete && node.naturalWidth > 0),
        `Loaded image: ${name}`,
      );
    }
    const nav = await page.getByRole("navigation").boundingBox();
    assert(
      nav && nav.y + nav.height <= page.viewportSize().height + 1,
      `Navigation in viewport: ${name}`,
    );
    if (screenshots) {
      await fs.mkdir(screenshots, { recursive: true });
      await page.screenshot({
        path: path.join(screenshots, `${name}.png`),
        fullPage: true,
      });
    }
  };
  try {
    await page.goto(baseURL);
    await visible(page.getByRole("textbox", { name: "Поиск сотрудника" }));
    await page
      .getByRole("textbox", { name: "Поиск сотрудника" })
      .fill("no-such-employee");
    await visible(page.getByText("Сотрудник не найден.", { exact: false }));
    await login("E0043");
    const profile = await (
      await page.request.get(`${baseURL}/api/me/profile`)
    ).json();
    await screenshot("mobile-bank");
    await page.getByRole("button", { name: "Открыть Мой рост" }).click();
    await visible(page.getByRole("heading", { name: "Расти в своём темпе" }));
    await screenshot("mobile-tree");
    await open("Цели");
    await visible(
      page.getByRole("heading", {
        name: profile.employee.goal_label || "Карьерная цель пока не выбрана",
      }),
    );
    await open("Профиль");
    await visible(
      page.getByRole("heading", {
        name: profile.employee.full_name,
        exact: true,
      }),
    );
    await visible(page.getByText(profile.employee.department, { exact: true }));
    await visible(page.getByRole("heading", { name: "Навыки вашей роли" }));
    await visible(page.getByRole("heading", { name: "История активностей" }));
    for (const skill of profile.skills)
      assert((await page.getByText(skill.name, { exact: true }).count()) > 0);
    for (const item of profile.history)
      assert(
        (await page
          .getByRole("heading", { name: item.title, exact: true })
          .count()) > 0,
      );
    const historyRows = page.getByRole("article");
    assert.equal(await historyRows.count(), profile.history_count);
    for (const [index, item] of profile.history.entries()) {
      const row = historyRows.nth(index);
      assert((await row.innerText()).includes(item.event_id));
      assert.equal(
        await row.locator("time").getAttribute("datetime"),
        item.date,
      );
    }
    await screenshot("mobile-profile");
    await open("Тесты");
    await visible(
      page.getByText("Прохождение и генерация тестов пока недоступны.", {
        exact: false,
      }),
    );
    await open("Halyk");
    await page.reload();
    await visible(page.getByRole("button", { name: "Открыть Мой рост" }));
    assert.equal(
      (await (await page.request.get(`${baseURL}/api/me/profile`)).json())
        .employee.employee_id,
      "E0043",
    );
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await login("E0001");
    const secondProfile = await (
      await page.request.get(`${baseURL}/api/me/profile`)
    ).json();
    await open("Цели");
    assert(secondProfile.employee.goal_label);
    await visible(
      page.getByRole("heading", { name: secondProfile.employee.goal_label }),
    );
    await open("Профиль");
    await visible(
      page.getByRole("heading", {
        name: secondProfile.employee.full_name,
        exact: true,
      }),
    );
    assert.equal(
      await page.getByText(profile.employee.full_name, { exact: true }).count(),
      0,
    );
    console.log(
      "PASS: search, login, Halyk entry, goal, all skills/history, navigation, reload and account isolation",
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    await screenshot("desktop-profile");
    await open("Дерево");
    await screenshot("desktop-tree");
    await open("Halyk");
    await screenshot("desktop-bank");
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(
        () => getComputedStyle(document.activeElement).outlineStyle !== "none",
      ),
    );
    console.log(
      "PASS: mobile 390×844 and desktop layout, tree assets, bottom navigation and keyboard focus",
    );

    // Faults are injected at the browser's HTTP boundary; main-flow data above is real.
    await page.route("**/api/me/profile", (route) =>
      route.fulfill({
        status: 503,
        json: { detail: "Сервис временно недоступен" },
      }),
    );
    await open("Профиль");
    await visible(page.getByRole("alert"));
    assert.equal(
      await page
        .getByText(secondProfile.employee.full_name, { exact: true })
        .count(),
      0,
    );
    await page.unroute("**/api/me/profile");
    await page.getByRole("button", { name: "Повторить загрузку" }).click();
    await visible(page.getByRole("button", { name: "Открыть Мой рост" }));
    await page.route("**/api/session", (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({
            status: 503,
            json: { detail: "Выход временно недоступен" },
          })
        : route.continue(),
    );
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await visible(page.getByRole("alert"));
    assert.equal(
      await page.getByRole("textbox", { name: "Поиск сотрудника" }).count(),
      0,
    );
    await page.unroute("**/api/session");
    await page.route("**/api/session", (route) =>
      route.fulfill({ status: 401, json: { detail: "Demo session expired" } }),
    );
    await tab("Дерево").click();
    await visible(page.getByText("Сессия истекла. Войдите снова."));
    await visible(page.getByRole("textbox", { name: "Поиск сотрудника" }));
    assert.equal(await page.getByRole("navigation").count(), 0);
    assert.equal(
      await page
        .getByRole("heading", {
          name: secondProfile.employee.full_name,
          exact: true,
        })
        .count(),
      0,
    );
    await page.unroute("**/api/session");
    console.log(
      "PASS: API failure, retry, failed logout and expired-session isolation",
    );

    await login("E0043");
    await page.route("**/api/me/profile", (route) =>
      route.fulfill({ status: 401, json: { detail: "Demo session expired" } }),
    );
    await page.reload();
    await visible(page.getByText("Сессия истекла. Войдите снова."));
    await visible(page.getByRole("textbox", { name: "Поиск сотрудника" }));
    await page.unroute("**/api/me/profile");
    console.log("PASS: expiry between session and profile during restoration");

    let releaseProfile;
    const gate = new Promise((resolve) => {
      releaseProfile = resolve;
    });
    await page.route("**/api/me/profile", async (route) => {
      await gate;
      await route.continue();
    });
    await page.getByRole("textbox", { name: "Поиск сотрудника" }).fill("E0043");
    await page.getByRole("button", { name: /E0043/ }).click();
    await visible(page.getByRole("status"));
    releaseProfile();
    await visible(page.getByRole("button", { name: "Открыть Мой рост" }));
    await page.unroute("**/api/me/profile");
    const emptyProfile = {
      ...profile,
      employee: { ...profile.employee, career_goal: null, goal_label: null },
      skills: [],
      history: [],
      history_count: 0,
    };
    await page.route("**/api/me/profile", (route) =>
      route.fulfill({ json: emptyProfile }),
    );
    await open("Цели");
    await visible(
      page.getByRole("heading", { name: "Карьерная цель пока не выбрана" }),
    );
    await open("Профиль");
    await visible(page.getByText("Навыки пока отсутствуют."));
    await visible(page.getByText("История активностей пока пуста."));
    await page.unroute("**/api/me/profile");
    console.log("PASS: loading, missing goal and empty skills/history states");

    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await page.getByRole("button", { name: "Войти как оператор" }).click();
    await visible(
      page.getByRole("heading", { name: "Настройки демонстрации" }),
    );
    await page.getByLabel("Дата демонстрации").fill("2026-11-12");
    await page.getByRole("button", { name: "Сохранить дату" }).click();
    await visible(page.getByText("Сохранено: 12.11.2026"));
    await page.reload();
    await visible(
      page.getByRole("heading", { name: "Настройки демонстрации" }),
    );
    assert.equal(
      await page.getByLabel("Дата демонстрации").inputValue(),
      "2026-11-12",
    );
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await login("E0043");
    await visible(page.getByText("Демо: 12.11.2026"));
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await page.getByRole("button", { name: "Войти как оператор" }).click();
    await visible(
      page.getByRole("heading", { name: "Настройки демонстрации" }),
    );
    await page.route("**/api/operator/clock", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 503, json: { detail: "Дата не сохранена" } })
        : route.continue(),
    );
    await page.getByLabel("Дата демонстрации").fill("2026-12-12");
    await page.getByRole("button", { name: "Сохранить дату" }).click();
    await visible(page.getByRole("alert"));
    assert.equal(await page.getByText(/^Сохранено:/).count(), 0);
    await page.unroute("**/api/operator/clock");
    await page.getByRole("button", { name: "Вернуть 1 октября" }).click();
    await visible(page.getByText("Сохранено: 01.10.2026"));
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await login("E0043");
    await visible(page.getByText("Демо: 01.10.2026"));
    console.log(
      "PASS: operator date save, session reload, employee date, failed-save feedback and reset",
    );
    assert.deepEqual(errors, [], "No uncaught browser errors");
    console.log("PASS: complete browser acceptance suite");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
