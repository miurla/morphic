/** Real UI acceptance with the local test double; no app network requests are mocked. */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

import { createFixturePdf } from './fixture.mjs'

const base = 'http://127.0.0.1:3002'
const output = '.tmp/tutor-smoke'
await mkdir(output, { recursive: true })
assert.equal(
  (await (await fetch('http://127.0.0.1:3106/health')).json()).testDouble,
  true
)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const result = { testDouble: true, checks: [], screenshots: [], errors: [] }
let currentPage
try {
  for (const locale of ['en', 'zh-CN']) {
    const zh = locale === 'zh-CN'
    const t = (en, chinese) => (zh ? chinese : en)
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale,
      colorScheme: 'light'
    })
    // Keep browser validation local even if unrelated app widgets attempt analytics.
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      return ['127.0.0.1', 'localhost'].includes(url.hostname) ||
        ['data:', 'blob:'].includes(url.protocol)
        ? route.continue()
        : route.abort()
    })
    await context.addCookies([
      { name: 'morphic-language', value: locale, url: base }
    ])
    const page = await context.newPage()
    currentPage = page
    page.on('pageerror', error =>
      result.errors.push({ locale, message: error.message })
    )
    const screenshot = async name => {
      const file = `${output}/${locale}-${name}.png`
      await page.screenshot({ path: file })
      result.screenshots.push(file)
    }
    const noOverflow = async () => {
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1
        ),
        `${locale}: horizontal page overflow`
      )
    }
    await page.goto(`${base}/tutor`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await expect(
      page.getByRole('heading', {
        name: t(
          'Turn saved knowledge into action! Upload your files.',
          '从收藏到行动！现在上传文件。'
        ),
        exact: true
      })
    ).toBeVisible({ timeout: 90_000 })
    await expect(
      page.getByRole('button', {
        name: t('Choose files', '选择文件'),
        exact: true
      })
    ).toBeEnabled({ timeout: 30_000 })
    await expect(page.locator('#tutor-files')).toHaveCount(1)
    await expect(
      page.getByRole('button', { name: 'Decide', exact: true })
    ).toHaveCount(0)
    await noOverflow()
    await screenshot('desktop-upload')
    await page.goto(base, { waitUntil: 'networkidle', timeout: 90_000 })
    await page.locator('main button[data-sidebar="trigger"]').click()
    await expect(
      page.getByRole('link', { name: 'Tutor', exact: true })
    ).toBeVisible()
    await expect
      .poll(async () =>
        Math.round(
          (await page.locator('[data-sidebar="sidebar"]').boundingBox()).x
        )
      )
      .toBe(0)
    await screenshot('desktop-sidebar')
    await page.getByRole('link', { name: 'Tutor', exact: true }).click()
    await expect(page).toHaveURL(`${base}/tutor`)
    await expect(page.locator('#tutor-files')).toHaveCount(1)
    await page
      .locator('[data-sidebar="sidebar"] button[data-sidebar="trigger"]')
      .click()
    await page.setViewportSize({ width: 375, height: 812 })
    await noOverflow()
    await screenshot('mobile-upload')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.locator('#tutor-files').setInputFiles({
      name: 'transactions.pdf',
      mimeType: 'application/pdf',
      buffer: createFixturePdf()
    })
    await expect(
      page.getByText(t('Uploaded', '已上传'), { exact: true })
    ).toBeVisible({ timeout: 30_000 })
    await page
      .locator('#tutor-goal')
      .fill(
        t(
          'Explain transaction atomicity and implement a safe transfer.',
          '准备后端面试：解释事务原子性，并设计可靠的转账流程。'
        )
      )
    const level = page.getByRole('radio', {
      name: t('Some experience', '有一定基础'),
      exact: true
    })
    await level.focus()
    await level.press('Space')
    await expect(level).toBeChecked()
    await page
      .getByRole('button', {
        name: t('Build my learning path', '生成学习路线'),
        exact: true
      })
      .click()
    await expect(
      page.getByRole('button', {
        name: t('Start this chapter', '开始本章'),
        exact: true
      })
    ).toBeVisible({ timeout: 90_000 })
    const courseId = new URL(page.url()).searchParams.get('course')
    assert.ok(courseId)
    await screenshot('desktop-course')
    await page
      .getByRole('button', {
        name: t('Start this chapter', '开始本章'),
        exact: true
      })
      .click()
    await expect(
      page.getByRole('tab', { name: t('Learn', '学习'), exact: true })
    ).toBeVisible({ timeout: 90_000 })
    await expect(
      page.getByRole('heading', {
        name: t('Concepts', '概念讲解'),
        exact: true
      })
    ).toBeVisible()
    await screenshot('desktop-lesson')
    await page
      .getByRole('button', { name: /transactions\.pdf/ })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('canvas')).toBeVisible({ timeout: 30_000 })
    await expect(dialog.locator('span[style*="left:"]')).not.toHaveCount(0, {
      timeout: 30_000
    })
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    assert.ok(
      await dialog
        .locator('canvas')
        .evaluate(canvas => canvas.width > 0 && canvas.height > 0)
    )
    await screenshot('desktop-source')
    await page.setViewportSize({ width: 375, height: 812 })
    await noOverflow()
    await screenshot('mobile-source')
    await page.keyboard.press('Escape')
    await page
      .getByRole('tab', { name: t('Practice', '练习'), exact: false })
      .click()
    const answer = page.getByRole('textbox', {
      name: t('Your answer to question 1', '第 1 题的答案'),
      exact: true
    })
    const draft = t(
      'Roll back both changes on failure and commit only when both succeed.',
      '失败时回滚两步修改，只有两步均成功才提交。'
    )
    await answer.fill(draft)
    await page.reload()
    await page
      .getByRole('tab', { name: t('Practice', '练习'), exact: false })
      .click({ timeout: 30_000 })
    await expect(answer).toHaveValue(draft)
    await page
      .getByRole('button', {
        name: t('Check my answer', '提交并查看反馈'),
        exact: true
      })
      .first()
      .click()
    await expect(
      page
        .getByText(t('Latest feedback', '最近一次反馈'), { exact: true })
        .first()
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('progressbar', {
        name: t('Chapter mastery', '章节掌握度'),
        exact: true
      })
    ).toHaveAttribute('aria-valuenow', '40')
    await noOverflow()
    await screenshot('mobile-assessment')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await screenshot('desktop-assessment')
    await page.reload()
    await expect(
      page.getByRole('progressbar', {
        name: t('Chapter mastery', '章节掌握度'),
        exact: true
      })
    ).toHaveAttribute('aria-valuenow', '40', { timeout: 30_000 })
    result.checks.push({
      locale,
      courseId,
      passed: [
        'localized upload UI',
        'chat sidebar Tutor navigation',
        'single Tutor mount',
        'no old shortcut chips',
        '375px without horizontal overflow',
        'real file upload',
        'course and chapter generated by worker',
        'PDF canvas and normalized highlights',
        'draft survives refresh',
        'answer feedback and mastery40',
        'mastery survives refresh'
      ]
    })
    await context.close()
  }
  assert.deepEqual(result.errors, [], 'Browser runtime errors')
  result.passed = true
} catch (error) {
  result.passed = false
  result.failure = error.message
  if (currentPage && !currentPage.isClosed())
    await currentPage.screenshot({ path: `${output}/browser-failure.png` })
  throw error
} finally {
  await writeFile(
    `${output}/browser-result.json`,
    JSON.stringify(result, null, 2)
  )
  await browser.close()
}
console.log(JSON.stringify(result, null, 2))
