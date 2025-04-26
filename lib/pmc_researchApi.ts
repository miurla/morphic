import axios from 'axios' // Import axios for error type checking
import { pmcAxiosInstance } from './pmc_axiosClient' // Import the configured Axios instance
import type {
  StartPmcResearchResponse,
  PmcResearchStatusResponse,
  PmcResearchResultResponse
} from '../types/pmc_research' // Adjusted import path and type names
import { Logger } from './logger' // Use logger for consistency

// TODO: Replace with your actual API base URL (or import from config)
const API_BASE_URL =
  process.env.NEXT_PUBLIC_PMC_RESEARCH_API_BASE_URL || 'http://localhost:8000' // Example using env var
const API_V1_STR = '/api/v1' // Adjust if your API path differs

// Base path for the research endpoints within the API
// Adjust if your API structure differs (e.g., /pmc/start instead of /research/start)
const RESEARCH_API_PATH = '/api/v1/research'

/**
 * Initiates a new PMC research task using Axios.
 */
export async function startPmcResearch(
  query: string
): Promise<StartPmcResearchResponse> {
  const endpoint = `${RESEARCH_API_PATH}/start` // Relative path
  Logger.debug(`Calling startPmcResearch: POST ${endpoint}`)
  const payload = { query: query } // Adjust payload structure if needed

  try {
    // Use the configured Axios instance
    const response = await pmcAxiosInstance.post<StartPmcResearchResponse>(
      endpoint,
      payload
    )
    Logger.debug(`Response received from startPmcResearch:`, response.data)
    if (!response?.data?.task_id) {
      Logger.warn('Task ID missing in startPmcResearch response data!')
      // Potentially throw an error here if task_id is strictly required
    }
    return response.data // Axios puts response data in the `data` property
  } catch (error) {
    Logger.error(`Error in startPmcResearch (POST ${endpoint}):`, error)
    if (axios.isAxiosError(error)) {
      Logger.error('Axios error details:', {
        message: error.message,
        response_data: error.response?.data,
        response_status: error.response?.status,
        request_config: error.config
      })
    } else {
      Logger.error('Non-Axios error:', error)
    }
    // Re-throw a more generic error or handle as needed by the hook
    const errorMsg = axios.isAxiosError(error)
      ? error.response?.data?.detail || error.message
      : (error as Error).message
    throw new Error(`Failed to start PMC research: ${errorMsg}`)
  }
}

/**
 * Checks the status of an ongoing PMC research task using Axios.
 */
export async function getPmcResearchStatus(
  taskId: string
): Promise<PmcResearchStatusResponse> {
  const endpoint = `${RESEARCH_API_PATH}/status/${taskId}` // Relative path
  Logger.debug(`Calling getPmcResearchStatus: GET ${endpoint}`)

  try {
    const response = await pmcAxiosInstance.get<PmcResearchStatusResponse>(
      endpoint
    )
    Logger.debug(
      `Response received from getPmcResearchStatus (${taskId}):`,
      response.data
    )
    return response.data
  } catch (error) {
    Logger.error(`Error in getPmcResearchStatus (GET ${endpoint}):`, error)
    if (axios.isAxiosError(error)) {
      Logger.error('Axios error details:', {
        message: error.message,
        response_data: error.response?.data,
        response_status: error.response?.status
      })
    }
    const errorMsg = axios.isAxiosError(error)
      ? error.response?.data?.detail || error.message
      : (error as Error).message
    throw new Error(`Failed to get PMC research status: ${errorMsg}`)
  }
}

/**
 * Retrieves the final results of a completed PMC research task using Axios.
 */
export async function getPmcResearchResults(
  taskId: string
): Promise<PmcResearchResultResponse> {
  const endpoint = `${RESEARCH_API_PATH}/result/${taskId}` // Relative path
  Logger.debug(`Calling getPmcResearchResults: GET ${endpoint}`)

  try {
    const response = await pmcAxiosInstance.get<PmcResearchResultResponse>(
      endpoint
    )
    Logger.debug(
      `Response received from getPmcResearchResults (${taskId}):`,
      response.data
    )
    return response.data
  } catch (error) {
    Logger.error(`Error in getPmcResearchResults (GET ${endpoint}):`, error)
    if (axios.isAxiosError(error)) {
      Logger.error('Axios error details:', {
        message: error.message,
        response_data: error.response?.data,
        response_status: error.response?.status
      })
    }
    const errorMsg = axios.isAxiosError(error)
      ? error.response?.data?.detail || error.message
      : (error as Error).message
    throw new Error(`Failed to get PMC research results: ${errorMsg}`)
  }
}
