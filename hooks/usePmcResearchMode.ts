import { useState, useEffect, useRef, useCallback } from 'react'
import {
  startPmcResearch,
  getPmcResearchStatus,
  getPmcResearchResults
} from '../lib/pmc_researchApi'
import type { PmcResearchResultResponse } from '../types/pmc_research'
import { Logger } from '../lib/logger'

const POLLING_INTERVAL = 5000

export interface UsePmcResearchModeResult {
  isPmcResearchMode: boolean
  setIsPmcResearchMode: React.Dispatch<React.SetStateAction<boolean>>
  isPollingPmc: boolean
  pmcResearchTaskId: string | null
  startPmcResearchTask: (query: string) => Promise<string>
  pmcResearchResultContent: string | null
  setPmcResearchResultContent: React.Dispatch<
    React.SetStateAction<string | null>
  >
}

export function usePmcResearchMode(): UsePmcResearchModeResult {
  const [isPmcResearchMode, setIsPmcResearchMode] = useState(false)
  const [pmcResearchTaskId, setPmcResearchTaskId] = useState<string | null>(
    null
  )
  const [isPollingPmc, setIsPollingPmc] = useState(false)
  const [pmcResearchResultContent, setPmcResearchResultContent] = useState<
    string | null
  >(null)
  const pollingIntervalRef = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      Logger.debug(`PMC polling stopped for task ID: ${pmcResearchTaskId}`)
    }
    setIsPollingPmc(false)
    setPmcResearchTaskId(null)
  }, [pmcResearchTaskId])

  const checkPmcStatus = useCallback(
    async (taskIdToCheck: string) => {
      if (!taskIdToCheck) {
        Logger.warn('checkPmcStatus called with empty taskId')
        return
      }
      Logger.debug(`Checking PMC status for ${taskIdToCheck}...`)
      const logPrefix = `[pmc-${taskIdToCheck}]`

      try {
        const statusResponse = await getPmcResearchStatus(taskIdToCheck)
        Logger.info(`${logPrefix} Status Update: ${statusResponse.status}`, {
          message: statusResponse.message,
          progress: statusResponse.progress
        })

        if (statusResponse.status === 'completed') {
          Logger.info(
            `${logPrefix} PMC research completed! Fetching results...`
          )

          const finalResponse = await getPmcResearchResults(taskIdToCheck)
          Logger.debug(`${logPrefix} Results received`, {
            query: finalResponse.query
          })

          let formattedContent = `## PMC Research Results for "${finalResponse.query}"\n\n`
          if (finalResponse.summary)
            formattedContent += `**Summary:**\n${finalResponse.summary}\n\n`
          if (finalResponse.markdown_report)
            formattedContent += `**Detailed Report:**\n${finalResponse.markdown_report}\n\n`
          if (finalResponse.articles && finalResponse.articles.length > 0) {
            formattedContent += `**Consulted Articles (${finalResponse.articles.length}):**\n`
            finalResponse.articles.forEach((article, index) => {
              formattedContent += `${index + 1}. ${article.title}${
                article.url ? ` ([Link](${article.url}))` : ''
              }\n`
            })
          }
          if (
            !finalResponse.summary &&
            !finalResponse.markdown_report &&
            (!finalResponse.articles || finalResponse.articles.length === 0)
          ) {
            formattedContent +=
              finalResponse.message || 'No detailed PMC results found.'
          }

          setPmcResearchResultContent(formattedContent)

          Logger.info(
            `${logPrefix} Success: Results ready for "${finalResponse.query}".`
          )
          stopPolling()
        } else if (statusResponse.status === 'failed') {
          Logger.error(
            `${logPrefix} PMC Research Failed: ${
              statusResponse.message || 'Unknown error'
            }`
          )
          stopPolling()
        }
      } catch (error) {
        Logger.error(
          `${logPrefix} Error during PMC status check/result fetch:`,
          error
        )
        stopPolling()
      }
    },
    [stopPolling]
  )

  const startPmcResearchTask = useCallback(
    async (query: string): Promise<string> => {
      setPmcResearchResultContent(null)
      setIsPollingPmc(true)
      const tempLogId = `pmc-pending-${Date.now()}`
      Logger.info(`[${tempLogId}] Starting PMC research...`, { query })

      try {
        const response = await startPmcResearch(query)
        if (!response?.task_id)
          throw new Error('Backend did not return a task_id for PMC research.')

        setPmcResearchTaskId(response.task_id)
        Logger.info(`[pmc-${response.task_id}] PMC research initiated`, {
          message: response.message,
          taskId: response.task_id
        })
        return response.task_id
      } catch (error) {
        Logger.error(`[${tempLogId}] Failed to start PMC research:`, error)
        setIsPollingPmc(false)
        throw error
      }
    },
    []
  )

  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    if (pmcResearchTaskId && isPollingPmc) {
      Logger.debug(`Starting PMC polling interval for ${pmcResearchTaskId}`)
      pollingIntervalRef.current = window.setInterval(() => {
        if (pmcResearchTaskId) {
          checkPmcStatus(pmcResearchTaskId)
        } else {
          Logger.warn(
            'PMC polling interval fired but task ID is null, stopping.'
          )
          if (pollingIntervalRef.current)
            clearInterval(pollingIntervalRef.current)
          setIsPollingPmc(false)
        }
      }, POLLING_INTERVAL)
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        Logger.debug(
          `PMC polling interval cleared for ${pmcResearchTaskId} during cleanup.`
        )
      }
    }
  }, [pmcResearchTaskId, isPollingPmc, checkPmcStatus])

  return {
    isPmcResearchMode,
    setIsPmcResearchMode,
    isPollingPmc,
    pmcResearchTaskId,
    startPmcResearchTask,
    pmcResearchResultContent,
    setPmcResearchResultContent
  }
}
