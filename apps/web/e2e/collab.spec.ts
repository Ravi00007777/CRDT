import { test, expect, type Browser, type Page } from '@playwright/test';

const uid = () => Math.random().toString(36).slice(2, 8);

async function signUp(browser: Browser, name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const email = `${name.toLowerCase()}-${uid()}@e2e.local`;
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Your documents' })).toBeVisible();
  return { page, email, ctx };
}

const body = (p: Page) => p.getByLabel('Document body');

/** Document HTML without remote-caret widgets (those differ per viewer by design). */
const contentHtml = (p: Page) =>
  body(p).evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll('.collaboration-carets__caret, .ProseMirror-separator, .ProseMirror-trailingBreak').forEach((n) => n.remove());
    c.querySelectorAll('.collaboration-carets__selection').forEach((n) => n.replaceWith(...n.childNodes));
    c.normalize();
    return c.innerHTML;
  });

async function openLive(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId('connection-status').first()).toHaveAttribute('data-status', 'connected');
  await expect(body(page)).toBeVisible();
}

test('two users edit the same document in real time', async ({ browser }) => {
  const alice = await signUp(browser, 'Alice');
  const bob = await signUp(browser, 'Bob');

  await alice.page.getByRole('button', { name: '+ New document' }).click();
  await expect(body(alice.page)).toBeVisible();
  const url = alice.page.url();

  // Share via UI.
  await alice.page.getByRole('button', { name: 'Share' }).click();
  await alice.page.getByLabel('Email to share with').fill(bob.email);
  await alice.page.getByRole('button', { name: 'Add' }).click();
  await expect(alice.page.getByText(bob.email)).toBeVisible();
  await alice.page.getByRole('button', { name: 'Done' }).click();

  await openLive(bob.page, url);

  // Presence: both see two people.
  await expect(alice.page.getByTestId('presence-user')).toHaveCount(2);
  await expect(bob.page.getByTestId('presence-user')).toHaveCount(2);

  // Alice types, Bob sees it via Yjs (no reload).
  await body(alice.page).click();
  await alice.page.keyboard.type('Hello from Alice.');
  await expect(body(bob.page)).toContainText('Hello from Alice.');

  // Formatting syncs as structure, not plain text.
  await alice.page.keyboard.press('Enter');
  await alice.page.getByRole('button', { name: 'Heading 2' }).click();
  await alice.page.keyboard.type('Shared heading');
  await expect.poll(() => bob.page.locator('.doc-body h2').evaluate((h) => h.firstChild?.textContent)).toBe('Shared heading');

  // Concurrent edits from both sides converge.
  await body(bob.page).locator('p').first().click();
  await bob.page.keyboard.press('End');
  await Promise.all([
    bob.page.keyboard.type(' Bob was here.'),
    (async () => { await alice.page.keyboard.press('End'); await alice.page.keyboard.type(' and Alice'); })(),
  ]);
  for (const p of [alice.page, bob.page]) {
    await expect(body(p)).toContainText('Bob was here.');
    await expect(body(p)).toContainText('Shared heading and Alice');
  }
  await expect.poll(async () => (await contentHtml(alice.page)) === (await contentHtml(bob.page))).toBe(true);

  // Remote caret label visible for Alice.
  await expect(alice.page.locator('.collaboration-carets__label', { hasText: 'Bob' })).toBeVisible();

  // Bob leaves → Alice's presence drops to one.
  await bob.ctx.close();
  await expect(alice.page.getByTestId('presence-user')).toHaveCount(1, { timeout: 15_000 });

  // Reload restores persisted state.
  await alice.page.reload();
  await expect(body(alice.page)).toContainText('Hello from Alice.');
  await expect(alice.page.locator('.doc-body h2')).toContainText('Shared heading');
  await alice.ctx.close();
});

test('documents are isolated and private', async ({ browser }) => {
  const alice = await signUp(browser, 'Alice');
  const mallory = await signUp(browser, 'Mallory');

  await alice.page.getByRole('button', { name: '+ New document' }).click();
  await expect(body(alice.page)).toBeVisible();
  const doc1 = alice.page.url();
  await body(alice.page).click();
  await alice.page.keyboard.type('Secret one');

  // Second doc in another tab of the same user sees nothing from doc 1.
  const tab2 = await alice.ctx.newPage();
  await tab2.goto('/');
  await tab2.getByRole('button', { name: '+ New document' }).click();
  await expect(body(tab2)).toBeVisible();
  await body(tab2).click();
  await tab2.keyboard.type('Doc two text');
  await expect(body(tab2)).not.toContainText('Secret one');
  await expect(body(alice.page)).not.toContainText('Doc two text');

  // Same doc in two tabs of one user syncs.
  const tab3 = await alice.ctx.newPage();
  await openLive(tab3, doc1);
  await expect(body(tab3)).toContainText('Secret one');

  // Another user can't open it by URL.
  await mallory.page.goto(doc1);
  await expect(mallory.page.getByRole('heading', { name: "Can't open this document" })).toBeVisible();
  await expect(body(mallory.page)).toHaveCount(0);

  await alice.ctx.close();
  await mallory.ctx.close();
});

test('owner deleting a document removes it from the dashboard', async ({ browser }) => {
  const alice = await signUp(browser, 'Alice');
  await alice.page.getByRole('button', { name: '+ New document' }).click();
  await expect(body(alice.page)).toBeVisible();
  await alice.page.getByLabel('Document title').fill('Doomed doc');
  await alice.page.getByLabel('Document title').press('Enter');
  await alice.page.getByLabel('Back to documents').click();
  const card = alice.page.getByRole('listitem').filter({ hasText: 'Doomed doc' });
  await card.hover();
  await card.getByRole('button', { name: 'Delete' }).click();
  await alice.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(card).toHaveCount(0);
  await alice.ctx.close();
});
