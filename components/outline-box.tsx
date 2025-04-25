'use client' // Assuming interaction requires client component

import React from 'react'

interface OutlineBoxProps {
  outlineText: string
  threadId: string
  onItemClick: (itemText: string, threadId: string) => void
}

const OutlineBox: React.FC<OutlineBoxProps> = ({
  outlineText,
  threadId,
  onItemClick
}) => {
  // 1. Process the outlineText into a list of items
  //    - Split by newline
  //    - Filter out empty lines
  //    - Trim whitespace from each item
  const items = outlineText
    .split('\n')
    .map(line => line.trim()) // Trim leading/trailing whitespace for easier clicking/comparison
    .filter(line => line.length > 0) // Remove empty lines

  if (items.length === 0) {
    // Don't render anything if there's no actual outline content
    return null
  }

  // Handler for clicking an item
  const handleItemClick = (itemText: string) => {
    // Call the callback passed via props
    onItemClick(itemText, threadId)
  }

  return (
    <div className="my-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-3 font-medium text-sm text-gray-700 dark:text-gray-300">
        Clique em um item para detalhar:
      </p>
      <ul className="space-y-1 list-none pl-0">
        {' '}
        {/* Using ul for semantics, but removing list styles */}
        {items.map((item, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => handleItemClick(item)}
              className="w-full text-left p-2 rounded text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors duration-150 ease-in-out cursor-pointer"
              style={{
                // Preserve original indentation visually if needed (basic example)
                // More complex indentation might require more sophisticated parsing
                paddingLeft: `${
                  0.5 + (item.length - item.trimStart().length) * 0.5
                }rem`
              }}
            >
              {item} {/* Display the item text */}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default OutlineBox
