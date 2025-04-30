# Add User Message Editing Functionality

This PR adds the functionality to edit user messages and regenerate the conversation based on the edited content.

## Changes

- Added edit button to user messages (visible on hover/focus)
- Implemented edit mode with textarea and save/cancel buttons
- Added functionality to update messages and regenerate the conversation
- Implemented proper state management for edited messages

## Implementation Details

- Enhanced `UserMessage` component with editing capabilities
- Updated `RenderMessage` to pass necessary props to `UserMessage`
- Added `onUpdateMessage` prop to `ChatMessages` for delegation
- Implemented `handleUpdateAndReloadMessage` function in the `Chat` component to:
  - Update the message content
  - Trim messages after the edited message
  - Regenerate the conversation using the new context

## How to Test

1. Start a conversation with the app
2. Hover over a user message to see the edit button (pencil icon)
3. Click the edit button to enter edit mode
4. Modify the message and click Save
5. The conversation should regenerate based on the edited message
