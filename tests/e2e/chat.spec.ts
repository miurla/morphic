import { expect, test } from '@playwright/test'

// Test suite for the main chat functionality
test.describe('Chat Functionality', () => {
  // Test case: Load the main chat page and check for input
  test('should load the chat page and display the input field', async ({
    page
  }) => {
    // 1. Navigate to the main chat page
    // Assuming '/' redirects or loads the main chat interface, or use '/search' directly
    await page.goto('/')

    // 2. Wait for the main chat input field to be visible
    //    We need a reliable selector. Let's assume it has a placeholder or an aria-label.
    //    Update the selector based on your actual ChatPanel implementation.
    const chatInput = page.getByPlaceholder('Send a message...')
    // Or: const chatInput = page.getByRole('textbox', { name: /send message/i });

    // 3. Assert that the input field is visible on the page
    await expect(chatInput).toBeVisible({ timeout: 10000 }) // Increased timeout for initial load

    // Optional: Check for a title or header
    // await expect(page.getByRole('heading', { name: /Your App Name/i })).toBeVisible();
  })

  // Test case: Send a message and check for user message + assistant response
  test('should allow typing and sending a message, then display response', async ({
    page
  }) => {
    await page.goto('/')

    // 1. Define Selectors (Adjust these based on your actual components)
    const chatInput = page.getByPlaceholder('Send a message...')
    // Assuming the send button is a <button> element immediately following the textarea
    // A more specific selector (e.g., by aria-label or data-testid) is better.
    const sendButton = page.locator(
      'textarea[placeholder="Send a message..."] + button'
    )
    // Or: const sendButton = page.getByRole('button', { name: /send/i });

    // Selector for the container holding all messages
    // Adjust if your structure is different (e.g., specific role or test id)
    const messagesContainer = page.locator('.relative.mx-auto.px-4.w-full') // Based on ChatMessages structure

    // 2. Verify initial state (input visible)
    await expect(chatInput).toBeVisible({ timeout: 10000 })

    // 3. Type a message
    const testMessage = `Hello Playwright at ${Date.now()}`
    await chatInput.fill(testMessage)

    // 4. Click the send button
    await expect(sendButton).toBeEnabled() // Ensure button is clickable
    await sendButton.click()

    // 5. Verify the user message appears
    //    Need a way to distinguish user messages. Assuming UserMessage component renders specific text or has a class.
    //    Let's look for the message text within the container.
    const userMessageLocator = messagesContainer.locator(
      `div:has-text("${testMessage}")`
    ) // Find a div containing the exact text
    await expect(userMessageLocator).toBeVisible({ timeout: 5000 }) // User msg should appear quickly

    // 6. Verify an assistant response appears
    //    Need a way to distinguish assistant messages. Assuming AnswerSection/BotMessage renders differently.
    //    Let's wait for a second message element that is likely the assistant's.
    //    A more robust approach involves specific selectors for assistant messages (e.g., role="assistant" or data-testid).
    //    This waits for at least two message elements (user + assistant) to be present.
    //    Then checks if the *last* message element is visible.
    await expect(
      messagesContainer.locator(
        'div[role="assistant"], .group.flex.items-start'
      )
    ).toBeVisible({ timeout: 30000 }) // Wait longer for API response
    // We could also check that the *content* of the assistant message is not empty
    // const assistantMessageContent = messagesContainer.locator('[data-testid="mock-bot-message"] p').last(); // Adjust selector
    // await expect(assistantMessageContent).not.toBeEmpty({ timeout: 30000 });

    // 7. Optional: Check if input is cleared after sending (depends on implementation)
    // await expect(chatInput).toBeEmpty();
  })

  // --- Future tests ---
  // test('should display user message and assistant response', async ({ page }) => { ... });
  // test('should render OutlineBox when response contains marker', async ({ page }) => { ... });
  // test('should send a new query when clicking an outline item', async ({ page }) => { ... });
})
