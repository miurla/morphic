import axios from 'axios'

// TODO: Ensure NEXT_PUBLIC_PMC_RESEARCH_API_BASE_URL is set in your .env.local or environment
const PMC_API_BASE_URL =
  process.env.NEXT_PUBLIC_PMC_RESEARCH_API_BASE_URL || 'http://localhost:8000' // Default fallback

// Create a dedicated Axios instance for the PMC Research API
const pmcAxiosInstance = axios.create({
  baseURL: PMC_API_BASE_URL, // Base URL for all requests made with this instance
  headers: {
    'Content-Type': 'application/json'
    // Add any other default headers needed for the PMC API here
  },
  withCredentials: true // Send cookies if necessary (like in the original source)
})

// Optional: Add interceptors for logging, request modification, or error handling
pmcAxiosInstance.interceptors.request.use(
  config => {
    // You could log requests here or add auth tokens dynamically
    console.log(
      `[PMC API Request] ${config.method?.toUpperCase()} ${config.url}`
    )
    return config
  },
  error => {
    console.error('[PMC API Request Error]', error)
    return Promise.reject(error)
  }
)

pmcAxiosInstance.interceptors.response.use(
  response => {
    // Log successful responses
    console.log(
      `[PMC API Response] ${response.status} from ${response.config.url}`
    )
    return response
  },
  error => {
    // Log errors globally or perform specific actions
    console.error(
      `[PMC API Response Error] Status: ${error.response?.status}`,
      error.message
    )
    // It's usually better to let the calling function handle the error logic
    return Promise.reject(error)
  }
)

export { pmcAxiosInstance }
