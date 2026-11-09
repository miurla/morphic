import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { SHORTCUT_EVENTS } from '@/lib/keyboard-shortcuts'
import type { UploadedFile } from '@/lib/types'
import { deleteCookie, getCookie, setCookie } from '@/lib/utils/cookies'

import { ChatPanel } from '../chat-panel'
import { NewChatMenuItem } from '../sidebar/new-chat-menu-item'

vi.mock('../ui/sidebar', () => ({
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('../artifact/artifact-context', () => ({
  useArtifact: () => ({ close: vi.fn() })
}))

vi.mock('../action-buttons', () => ({
  ActionButtons: () => <div data-testid="suggestions" />
}))

vi.mock('../library/library-context', () => ({
  useLibrary: () => ({
    upsertCachedFile: vi.fn()
  })
}))

let attachLibraryFile: ((file: UploadedFile) => boolean) | undefined

vi.mock('../library/library-picker-dialog', () => ({
  LibraryPickerDialog: ({
    onAttachFile
  }: {
    onAttachFile: (file: UploadedFile) => boolean
  }) => {
    attachLibraryFile = onAttachFile
    return null
  }
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('../message-navigation-dots', () => ({
  MessageNavigationDots: () => null
}))

vi.mock('../model-selector-client', () => ({
  ModelSelectorClient: () => null
}))

vi.mock('../uploaded-file-list', () => ({
  UploadedFileList: () => null
}))

vi.mock('../ui/icons', () => ({
  IconBlinkingLogo: () => <div data-testid="logo" />,
  IconLogoOutline: ({ className }: { className?: string }) => (
    <span className={className} data-testid="adaptive-icon" />
  )
}))

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteCookie('searchMode')
  })

  test.each(['sidebar', 'shortcut'])(
    'the %s resets an empty homepage draft and leaves a hidden cached panel alone',
    action => {
      const hiddenReset = vi.fn()
      const visibleReset = vi.fn()
      const props = {
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        status: 'ready' as const,
        messages: [],
        setMessages: vi.fn(),
        stop: vi.fn(),
        append: vi.fn(),
        showScrollToBottomButton: false,
        uploadedFiles: [],
        setUploadedFiles: vi.fn(),
        quotedContexts: [],
        setQuotedContexts: vi.fn(),
        noteContexts: [],
        setNoteContexts: vi.fn()
      }
      const view = render(
        <>
          <ChatPanel
            {...props}
            chatId="hidden"
            scrollContainerRef={React.createRef<HTMLDivElement>()}
            onNewChat={hiddenReset}
          />
          <ChatPanel
            {...props}
            chatId="visible"
            scrollContainerRef={React.createRef<HTMLDivElement>()}
            onNewChat={visibleReset}
          />
          <NewChatMenuItem />
        </>
      )
      const visiblePanel = screen
        .getAllByRole('textbox')[1]
        .parentElement!.closest('[class*="group/form-container"]')!
      Object.defineProperty(visiblePanel, 'offsetParent', {
        value: document.body
      })
      const hiddenContent = 'hidden pasted context '.repeat(30)
      const visibleContent = 'visible pasted context '.repeat(30)
      const inputs = screen.getAllByRole('textbox')
      for (const [input, content, url] of [
        [inputs[0], hiddenContent, 'https://hidden.example'],
        [inputs[1], visibleContent, 'https://visible.example']
      ] as const) {
        fireEvent.paste(input, { clipboardData: { getData: () => content } })
        fireEvent.paste(input, { clipboardData: { getData: () => url } })
      }
      expect(screen.getByText(visibleContent.trim())).toBeInTheDocument()
      expect(screen.getByText('visible.example')).toBeInTheDocument()
      const event = new Event(SHORTCUT_EVENTS.newChat, { cancelable: true })
      if (action === 'sidebar') {
        fireEvent.click(screen.getByRole('link', { name: 'New' }))
      } else {
        fireEvent(window, event)
        expect(event.defaultPrevented).toBe(true)
      }
      expect(visibleReset).toHaveBeenCalledOnce()
      expect(hiddenReset).not.toHaveBeenCalled()
      expect(screen.queryByText(visibleContent.trim())).not.toBeInTheDocument()
      expect(screen.queryByText('visible.example')).not.toBeInTheDocument()
      expect(screen.getByText(hiddenContent.trim())).toBeInTheDocument()
      expect(screen.getByText('hidden.example')).toBeInTheDocument()
      view.unmount()
    }
  )

  test('keeps the new-chat shortcut active while hiding the unresolved history panel', () => {
    const onNewChat = vi.fn()
    const props = {
      chatId: 'chat',
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      status: 'ready' as const,
      messages: [],
      setMessages: vi.fn(),
      stop: vi.fn(),
      append: vi.fn(),
      showScrollToBottomButton: false,
      scrollContainerRef: React.createRef<HTMLDivElement>(),
      uploadedFiles: [],
      setUploadedFiles: vi.fn(),
      quotedContexts: [],
      setQuotedContexts: vi.fn(),
      noteContexts: [],
      setNoteContexts: vi.fn()
    }
    const view = render(
      <ChatPanel {...props} onNewChat={onNewChat} isHistoryPending />
    )
    const panel = view.container.firstElementChild
    if (panel)
      Object.defineProperty(panel, 'offsetParent', { value: document.body })
    const event = new Event(SHORTCUT_EVENTS.newChat, { cancelable: true })
    fireEvent(window, event)
    expect(event.defaultPrevented).toBe(true)
    expect(onNewChat).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('heading', { name: 'What would you like to know?' })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('suggestions')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    view.rerender(<ChatPanel {...props} />)
    expect(
      screen.getByRole('heading', { name: 'What would you like to know?' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('suggestions')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  test('preserves and submits the initial query after resetting a stale adaptive cookie', async () => {
    const append = vi.fn()
    const onAdaptiveModeAuthRequired = vi.fn()
    setCookie('searchMode', 'adaptive')

    render(
      <ChatPanel
        chatId="chat-1"
        input=""
        handleInputChange={vi.fn()}
        handleSubmit={vi.fn()}
        status="ready"
        messages={[]}
        setMessages={vi.fn()}
        query="latest news"
        stop={vi.fn()}
        append={append}
        showScrollToBottomButton={false}
        scrollContainerRef={React.createRef<HTMLDivElement>()}
        uploadedFiles={[]}
        setUploadedFiles={vi.fn()}
        quotedContexts={[]}
        setQuotedContexts={vi.fn()}
        noteContexts={[]}
        setNoteContexts={vi.fn()}
        isGuest
        isCloudDeployment
        onAdaptiveModeAuthRequired={onAdaptiveModeAuthRequired}
      />
    )

    await waitFor(() => {
      expect(getCookie('searchMode')).toBe('quick')
    })
    await waitFor(() => {
      expect(append).toHaveBeenCalledWith({
        role: 'user',
        parts: [{ type: 'text', text: 'latest news' }]
      })
    })
    expect(onAdaptiveModeAuthRequired).not.toHaveBeenCalled()
  })

  test('starts a new chat without clearing the cached conversation', () => {
    const scrollRef = { current: document.createElement('div') }
    const setMessages = vi.fn()
    const onNewChat = vi.fn()
    render(
      <ChatPanel
        chatId="chat"
        input=""
        handleInputChange={vi.fn()}
        handleSubmit={vi.fn()}
        status="ready"
        messages={[]}
        setMessages={setMessages}
        stop={vi.fn()}
        append={vi.fn()}
        showScrollToBottomButton={false}
        scrollContainerRef={scrollRef}
        uploadedFiles={[]}
        setUploadedFiles={vi.fn()}
        quotedContexts={[]}
        setQuotedContexts={vi.fn()}
        noteContexts={[]}
        setNoteContexts={vi.fn()}
        onNewChat={onNewChat}
      />
    )
    Object.defineProperty(
      screen.getByRole('textbox').closest('[class*="group/form-container"]')!,
      'offsetParent',
      { value: document.body }
    )
    fireEvent(window, new Event(SHORTCUT_EVENTS.newChat, { cancelable: true }))
    expect(onNewChat).toHaveBeenCalledOnce()
    expect(setMessages).not.toHaveBeenCalled()
  })

  test('opens the attachment menu as a collision-aware dropdown', () => {
    const { container } = render(
      <ChatPanel
        chatId="chat"
        input=""
        handleInputChange={vi.fn()}
        handleSubmit={vi.fn()}
        status="ready"
        messages={[
          { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }
        ]}
        setMessages={vi.fn()}
        stop={vi.fn()}
        append={vi.fn()}
        showScrollToBottomButton={false}
        scrollContainerRef={React.createRef<HTMLDivElement>()}
        uploadedFiles={[]}
        setUploadedFiles={vi.fn()}
        quotedContexts={[]}
        setQuotedContexts={vi.fn()}
        noteContexts={[]}
        setNoteContexts={vi.fn()}
      />
    )
    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const clickFileInput = vi.spyOn(fileInput, 'click')

    fireEvent.keyDown(screen.getByRole('button', { name: 'Add' }), {
      key: 'Enter'
    })
    expect(screen.getByRole('menu')).toHaveAttribute('data-side', 'bottom')
    expect(
      screen.getByRole('menuitem', { name: 'Add from library' })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Upload file' }))
    expect(clickFileInput).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  test('leaves focus to the library picker instead of the Add button', async () => {
    render(
      <ChatPanel
        chatId="chat"
        input=""
        handleInputChange={vi.fn()}
        handleSubmit={vi.fn()}
        status="ready"
        messages={[]}
        setMessages={vi.fn()}
        stop={vi.fn()}
        append={vi.fn()}
        showScrollToBottomButton={false}
        scrollContainerRef={React.createRef<HTMLDivElement>()}
        uploadedFiles={[]}
        setUploadedFiles={vi.fn()}
        quotedContexts={[]}
        setQuotedContexts={vi.fn()}
        noteContexts={[]}
        setNoteContexts={vi.fn()}
      />
    )
    const addButton = screen.getByRole('button', { name: 'Add' })

    fireEvent.keyDown(addButton, { key: 'Enter' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Upload file' }))
    await waitFor(() => expect(addButton).toHaveFocus())
    addButton.blur()

    fireEvent.keyDown(addButton, { key: 'Enter' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add from library' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(addButton).not.toHaveFocus()
  })

  describe('attachment limit', () => {
    const existing = (count: number): UploadedFile[] =>
      Array.from({ length: count }, (_, i) => ({
        status: 'uploaded',
        name: `existing-${i}.pdf`,
        key: `key-${i}`,
        mediaType: 'application/pdf',
        libraryFileId: `lib-${i}`
      }))

    function renderPanel(uploadedFiles: UploadedFile[]) {
      const setUploadedFiles = vi.fn()
      const utils = render(
        <ChatPanel
          chatId="chat-1"
          input=""
          handleInputChange={vi.fn()}
          handleSubmit={vi.fn()}
          status="ready"
          messages={[]}
          setMessages={vi.fn()}
          stop={vi.fn()}
          append={vi.fn()}
          showScrollToBottomButton={false}
          scrollContainerRef={React.createRef<HTMLDivElement>()}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
          quotedContexts={[]}
          setQuotedContexts={vi.fn()}
          noteContexts={[]}
          setNoteContexts={vi.fn()}
          isGuest={false}
          isCloudDeployment
          onAdaptiveModeAuthRequired={vi.fn()}
        />
      )
      return { ...utils, setUploadedFiles }
    }

    test('file picker only uploads into the remaining slots', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          file: {
            url: 'u',
            filename: 'f.pdf',
            key: 'k',
            mediaType: 'application/pdf'
          }
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const { container } = renderPanel(existing(2))
      const input = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      const files = ['a.pdf', 'b.pdf'].map(
        name => new File(['x'], name, { type: 'application/pdf' })
      )
      fireEvent.change(input, { target: { files } })

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      expect(toast.error).toHaveBeenCalledWith(
        'You can attach up to 3 files per message.'
      )
      vi.unstubAllGlobals()
    })

    test('file picker uploads nothing when the message is full', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { container, setUploadedFiles } = renderPanel(existing(3))
      const input = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      fireEvent.change(input, {
        target: {
          files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })]
        }
      })

      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(fetchMock).not.toHaveBeenCalled()
      expect(setUploadedFiles).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    })

    test('library attach is refused when the message is full', () => {
      const { setUploadedFiles } = renderPanel(existing(3))

      const attached = attachLibraryFile?.({
        status: 'uploaded',
        name: 'new.pdf',
        key: 'new-key',
        mediaType: 'application/pdf',
        libraryFileId: 'lib-new'
      })

      expect(attached).toBe(false)
      expect(setUploadedFiles).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith(
        'You can attach up to 3 files per message.'
      )
    })
  })
})
