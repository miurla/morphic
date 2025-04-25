export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001',
  API_V1_STR: process.env.NEXT_PUBLIC_API_V1_STR || '/api/v1',
  ASSISTANT_ID:
    process.env.NEXT_PUBLIC_ASSISTANT_ID || 'asst_SBZgHhHdk1L2s4nR6jzNvtNk'
} as const

// Helper para construir URLs da API
export const getApiUrl = (path: string) =>
  `${API_CONFIG.BASE_URL}${API_CONFIG.API_V1_STR}${path}`
