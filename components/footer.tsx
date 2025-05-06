import React from 'react'
// import { SiDiscord, SiGithub, SiX } from 'react-icons/si' // Removed
// import { Button } from './ui/button' // Removed if Button is no longer used

const Footer: React.FC = () => {
  // Footer content is now removed.
  // Consider if the footer component itself is still needed.
  // If not, it can be deleted and removed from app/layout.tsx.
  return (
    <footer className="w-fit p-1 md:p-2 fixed bottom-0 right-0 hidden lg:block">
      <div className="flex justify-end">{/* Social links were here */}</div>
    </footer>
  )
  // Or, if the footer is no longer needed at all:
  // return null
}

export default Footer
