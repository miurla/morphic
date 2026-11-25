/** Isolated deletion acceptance. Creates and deletes only this run's courses.
 * The provider is a deterministic test double. Browser-only 403/503 responses
 * and one held DELETE exercise errors/loading; successful deletion is real.
 */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import postgres from 'postgres'

import { createFixturePdf } from './fixture.mjs'

const base = 'http://127.0.0.1:3002'
const output = '.tmp/tutor-deletion'
await mkdir(output, { recursive: true })
assert.equal(
  (await (await fetch('http://127.0.0.1:3106/health')).json()).testDouble,
  true
)
const sql = postgres(
  'postgres://tutor_test:tutor_test_local@127.0.0.1:15433/tutor_test',
  { ssl: false, max: 1 }
)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const created = new Set()
const result = {
  testDouble: true,
  injectedStates: [
    '403 permission denial',
    '503 temporary failure',
    'held DELETE request',
    '503 list failure and empty list after all current fixtures are deleted'
  ],
  checks: [],
  contrast: [],
  screenshots: [],
  errors: []
}
async function request(route, options = {}) {
  const response = await fetch(`${base}/api/tutor${route}`, {
    ...options,
    headers: {
      Origin: base,
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers
    }
  })
  const body = await response.json()
  assert.ok(response.ok, `${route}: ${response.status} ${body.error ?? ''}`)
  return body
}
async function create(documentId, locale, title) {
  const { course } = await request('/courses', {
    method: 'POST',
    body: JSON.stringify({
      documentIds: [documentId],
      goal: 'Explain atomicity and transaction rollback.',
      level: 'beginner',
      locale
    })
  })
  created.add(course.id)
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const current = (await request(`/courses/${course.id}`)).course
    assert.notEqual(current.status, 'failed', current.error)
    if (current.status === 'ready') {
      // A long title fixture, scoped to a course created above, in tutor_test only.
      const updated =
        await sql`UPDATE tutor_courses SET title = ${title} WHERE id = ${course.id} AND user_id = 'tutor-smoke-user' RETURNING id`
      assert.equal(updated.length, 1)
      return { ...current, title }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Isolated course preparation timed out')
}
let currentPage
try {
  const initial = await request('/courses')
  const baseline = initial.courses.map(course => course.id)
  result.baselineCourseCount = baseline.length
  const form = new FormData()
  form.set(
    'file',
    new Blob([createFixturePdf()], { type: 'application/pdf' }),
    'deletion-fixture.pdf'
  )
  const { document } = await request('/documents', {
    method: 'POST',
    body: form
  })
  for (const locale of ['en', 'zh-CN']) {
    const zh = locale === 'zh-CN'
    const t = (en, chinese) => (zh ? chinese : en)
    const title = t(
      'Database transactions and reliable rollback: a detailed learning path for backend interviews and practical failure recovery',
      '数据库事务与可靠回滚：面向后端面试、并发控制、故障恢复及实际转账场景的完整学习路线与练习'
    )
    const primary = await create(document.id, locale, title)
    const survivor = await create(
      document.id,
      locale,
      t('Shared materials survivor', '共享资料保留验证')
    )
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale,
      colorScheme: 'light',
      reducedMotion: 'reduce'
    })
    await context.addCookies([
      { name: 'morphic-language', value: locale, url: base }
    ])
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      return ['127.0.0.1', 'localhost'].includes(url.hostname) ||
        ['data:', 'blob:'].includes(url.protocol)
        ? route.continue()
        : route.abort()
    })
    const page = await context.newPage()
    currentPage = page
    page.on('pageerror', error =>
      result.errors.push({ locale, message: error.message })
    )
    const capture = async (name, observation) => {
      const artifact = `${locale}-${name}.png`
      await page.screenshot({
        path: `${output}/${artifact}`,
        fullPage: false,
        animations: 'disabled'
      })
      const size = page.viewportSize()
      result.screenshots.push({
        viewport: `${size.width}x${size.height}`,
        artifact,
        observation
      })
    }
    const noOverflow = async () => {
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1
        ),
        'Page horizontal overflow'
      )
      const dialog = page.getByRole('alertdialog')
      if (await dialog.count())
        assert.ok(
          await dialog.evaluate(
            element => element.scrollWidth <= element.clientWidth + 1
          ),
          'Dialog horizontal overflow'
        )
    }
    const actions = label =>
      page.getByRole('button', {
        name: t(`Actions for ${label}`, `“${label}”的操作`),
        exact: true
      })
    const checkContrast = async (element, label, backgroundToken) => {
      const ratio = await element.evaluate((node, token) => {
        const style = getComputedStyle(node)
        const context = document.createElement('canvas').getContext('2d')
        const luminance = color => {
          context.fillStyle = color
          context.fillRect(0, 0, 1, 1)
          const channels = [...context.getImageData(0, 0, 1, 1).data]
            .slice(0, 3)
            .map(value => {
              const channel = value / 255
              return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4
            })
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          )
        }
        const a = luminance(style.color)
        const b = luminance(
          token ? style.getPropertyValue(token).trim() : style.backgroundColor
        )
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      }, backgroundToken)
      result.contrast.push({ locale, label, ratio })
      assert.ok(
        ratio >= 4.5,
        `${label} contrast ${ratio.toFixed(2)} is below 4.5:1`
      )
    }
    const openDialog = async label => {
      const trigger = actions(label)
      await expect(trigger).toBeVisible()
      await trigger.focus()
      await trigger.press('ArrowDown')
      const item = page.getByRole('menuitem', {
        name: t('Delete learning path', '删除学习路线'),
        exact: true
      })
      await expect(item).toBeVisible()
      await checkContrast(item, 'Focused destructive menu text', '--accent')
      await item.press('Enter')
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: t('Cancel', '取消'), exact: true })
      ).toBeFocused()
      return dialog
    }
    await page.goto(`${base}/tutor`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await expect(actions(primary.title)).toBeVisible({ timeout: 90_000 })
    await capture(
      'desktop-list',
      'Real course list shows separate always-visible menu buttons; titles truncate without nesting buttons.'
    )
    assert.equal(await page.locator('button button').count(), 0)
    const targetSize = await actions(primary.title).boundingBox()
    assert.ok(targetSize.width >= 44 && targetSize.height >= 44)
    let dialog = await openDialog(primary.title)
    await noOverflow()
    await capture(
      'desktop-confirm',
      'Keyboard opens the deletion dialog and initially focuses Cancel; full long title and permanent deletion warning fit.'
    )
    await checkContrast(
      dialog.getByRole('button', {
        name: t('Delete learning path', '删除学习路线'),
        exact: true
      }),
      'Light deletion button'
    )
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await capture(
      'desktop-dark-confirm',
      'Dark theme keeps the long title and focused Cancel readable; destructive button contrast is measured.'
    )
    await checkContrast(
      dialog.getByRole('button', {
        name: t('Delete learning path', '删除学习路线'),
        exact: true
      }),
      'Dark deletion button'
    )
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    await dialog
      .getByRole('button', { name: t('Cancel', '取消'), exact: true })
      .press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(actions(primary.title)).toBeFocused()
    assert.equal(
      (await request(`/courses/${primary.id}`)).course.id,
      primary.id
    )
    result.checks.push(
      `${locale}: list menu is separate, 44px touch target; keyboard open/cancel preserves real data and restores focus`
    )

    await page.goto(`${base}/tutor?course=${primary.id}`, {
      waitUntil: 'domcontentloaded'
    })
    await expect(actions(primary.title)).toBeVisible()
    await page.setViewportSize({ width: 375, height: 812 })
    await capture(
      'mobile-detail',
      'Narrow detail toolbar retains the course menu, chapter contents, and new-course action.'
    )
    dialog = await openDialog(primary.title)
    await noOverflow()
    await capture(
      'mobile-confirm',
      '375px dialog wraps a long title and its warning, with visible Cancel and Delete buttons.'
    )
    const deleteButton = () =>
      dialog.getByRole('button', {
        name: t('Delete learning path', '删除学习路线'),
        exact: true
      })
    let injected = 0
    let release
    const held = new Promise(resolve => {
      release = resolve
    })
    await page.route(`${base}/api/tutor/courses/${primary.id}`, async route => {
      if (route.request().method() !== 'DELETE') return route.continue()
      injected++
      if (injected <= 2)
        return route.fulfill({
          status: injected === 1 ? 403 : 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error:
              injected === 1
                ? t('Permission denied for this test.', '本次测试拒绝删除。')
                : t(
                    'Temporary test failure. Try again.',
                    '临时测试故障，请重试。'
                  )
          })
        })
      await held
      return route.continue()
    })
    await deleteButton().click()
    await expect(dialog.getByRole('alert')).toContainText(
      t('Permission denied', '拒绝删除')
    )
    await capture(
      'mobile-permission',
      'Injected 403 leaves the path and dialog intact, showing the denial and allowing cancel.'
    )
    await deleteButton().click()
    await expect(dialog.getByRole('alert')).toContainText(
      t('Temporary test failure', '临时测试故障')
    )
    await checkContrast(
      dialog.getByRole('alert'),
      'Light error text',
      '--background'
    )
    await capture(
      'mobile-error',
      'Injected 503 retains the confirmation and exposes retry without losing the route.'
    )
    await deleteButton().click()
    const busy = dialog.getByRole('button', {
      name: t('Deleting…', '删除中…'),
      exact: true
    })
    await expect(busy).toBeDisabled()
    await expect(
      dialog.getByRole('button', { name: t('Cancel', '取消'), exact: true })
    ).toBeDisabled()
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await expect(busy.locator('svg')).toHaveCSS('animation-name', 'none')
    await capture(
      'mobile-pending',
      'Held real DELETE shows disabled pending controls; reduced-motion preference disables spinner animation.'
    )
    await page.evaluate(
      id =>
        sessionStorage.setItem(
          `tutor-draft:tutor-smoke-user:${id}:fixture`,
          'draft'
        ),
      primary.id
    )
    release()
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(`${base}/tutor`)
    await expect(page.locator('header [tabindex="-1"]')).toBeFocused()
    created.delete(primary.id)
    await expect(actions(primary.title)).toHaveCount(0)
    assert.equal(
      await page.evaluate(
        id =>
          sessionStorage.getItem(`tutor-draft:tutor-smoke-user:${id}:fixture`),
        primary.id
      ),
      null
    )
    assert.equal(
      (await fetch(`${base}/api/tutor/courses/${primary.id}`)).status,
      404
    )
    assert.equal(
      (await request(`/courses/${survivor.id}`)).course.documents[0].id,
      document.id
    )
    assert.equal(
      (await fetch(`${base}/api/tutor/documents/${document.id}/file`)).status,
      200
    )
    await capture(
      'mobile-success',
      'Real delete returns to the list, removes the route and draft, and keeps another route sharing its original document.'
    )
    result.checks.push(
      `${locale}: detail delete handles injected 403/503, pending and retry; real DELETE removes course, returns home, and keeps shared document`
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(actions(primary.title)).toHaveCount(0)
    await expect(actions(survivor.title)).toBeVisible()
    dialog = await openDialog(survivor.title)
    await deleteButton().click()
    await expect(dialog).toHaveCount(0)
    created.delete(survivor.id)
    await expect(actions(survivor.title)).toHaveCount(0)
    // Do not remove preexisting smoke fixtures to obtain an empty screenshot.
    // Exercise partial/empty UI states by injecting only the list response.
    let failList = true
    await page.route(`${base}/api/tutor/courses`, route => {
      if (route.request().method() !== 'GET') return route.continue()
      return route.fulfill({
        status: failList ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify(
          failList
            ? {
                error: t(
                  'Course list is temporarily unavailable.',
                  '课程列表暂时不可用。'
                )
              }
            : { courses: [], capabilities: initial.capabilities }
        )
      })
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    const listError = page.getByRole('alert').filter({
      hasText: t(
        'Course list is temporarily unavailable.',
        '课程列表暂时不可用。'
      )
    })
    await expect(listError).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: t('Build my learning path', '生成学习路线'),
        exact: true
      })
    ).toBeVisible()
    await capture(
      'mobile-partial',
      'Injected list 503 shows an actionable Retry banner while the course-creation form remains available.'
    )
    failList = false
    await page
      .getByRole('button', { name: t('Retry', '重试'), exact: true })
      .click()
    await expect(listError).toHaveCount(0)
    await expect(page.getByRole('combobox')).toHaveCount(0)
    await noOverflow()
    await capture(
      'mobile-empty',
      'Injected empty list after deleting current fixtures leaves the creation form and no course selector; baseline data is untouched.'
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await capture(
      'desktop-empty',
      'Injected empty list after deletion retains a usable desktop creation form.'
    )
    result.checks.push(
      `${locale}: deleted course stays absent after reload; current fixtures removed without touching baseline routes; injected partial/empty states retain creation and recovery actions`
    )
    await context.close()
  }
  assert.deepEqual(
    (await request('/courses')).courses.map(course => course.id).sort(),
    baseline.sort()
  )
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors))
  result.passed = true
} catch (error) {
  result.passed = false
  result.failure = error.stack
  if (currentPage && !currentPage.isClosed())
    await currentPage
      .screenshot({ path: `${output}/failure.png`, fullPage: true })
      .catch(() => {})
  process.exitCode = 1
} finally {
  for (const courseId of created)
    await request(`/courses/${courseId}`, { method: 'DELETE' }).catch(() => {})
  await browser.close()
  await sql.end()
  await writeFile(`${output}/result.json`, JSON.stringify(result, null, 2))
  console.log(
    JSON.stringify(
      { passed: result.passed, checks: result.checks, failure: result.failure },
      null,
      2
    )
  )
}
