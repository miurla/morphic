import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
          background: 'linear-gradient(180deg, #f8fafc 0%, #e5e7eb 100%)',
          color: '#111827',
          fontSize: 88,
          fontWeight: 700,
          fontFamily: 'system-ui'
        }}
      >
        M
      </div>
    ),
    size
  )
}
