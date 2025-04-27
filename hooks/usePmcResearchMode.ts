import { getCookie, setCookie } from '@/lib/utils/cookies'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Logger } from '../lib/logger'
import {
  getPmcResearchResults,
  getPmcResearchStatus,
  startPmcResearch
} from '../lib/pmc_researchApi'
import type { PmcResearchResultResponse } from '../types/pmc_research'

// Module-level variables to persist state across hook re-initializations
let modulePmcTaskId: string | null = null
let moduleIsPolling: boolean = false

const POLLING_INTERVAL = 5000

export interface UsePmcResearchModeResult {
  isPmcResearchMode: boolean
  setIsPmcResearchMode: (
    value: boolean | ((prevState: boolean) => boolean)
  ) => void
  isPollingPmc: boolean
  pmcResearchTaskId: string | null
  startPmcResearchTask: (query: string) => Promise<string>
  pmcResearchResultData: PmcResearchResultResponse | null
  setPmcResearchResultData: React.Dispatch<
    React.SetStateAction<PmcResearchResultResponse | null>
  >
}

export function usePmcResearchMode(): UsePmcResearchModeResult {
  console.log(
    `!!!!!! usePmcResearchMode Hook Initializing/Re-running !!!!!! Module Task ID: ${modulePmcTaskId}, Module Polling: ${moduleIsPolling}`
  )

  // Default initial state, cookie will be read in useEffect client-side
  const [isPmcResearchMode, _internalSetIsPmcResearchMode] = useState(true)
  const [pmcResearchTaskId, _internalSetPmcResearchTaskId] = useState<
    string | null
  >(modulePmcTaskId)
  const [isPollingPmc, _internalSetIsPollingPmc] =
    useState<boolean>(moduleIsPolling)
  const [pmcResearchResultData, setPmcResearchResultData] =
    useState<PmcResearchResultResponse | null>(null)
  const pollingIntervalRef = useRef<number | null>(null)

  // Effect to read initial mode from cookie on client mount
  useEffect(() => {
    const savedMode = getCookie('search-mode')
    if (savedMode !== null) {
      console.log(
        '[usePmcResearchMode Mount Effect] Found cookie value:',
        savedMode
      )
      const initialValue = savedMode === 'true'
      // Use the internal setter directly to avoid triggering the wrapper's cookie set
      _internalSetIsPmcResearchMode(initialValue)
    } else {
      console.log(
        '[usePmcResearchMode Mount Effect] No cookie found, defaulting to true.'
      )
      // Optional: Set cookie to default if not found
      // setCookie('search-mode', 'true')
    }
    // Empty dependency array ensures this runs only once on mount
  }, []) // <- Added empty dependency array

  // Wrapper setters to update both React state and module variables
  const setPmcResearchTaskId = useCallback(
    (taskId: string | null) => {
      console.log(
        `[usePmcResearchMode] Setting Task ID. Module: ${taskId}, React State: ${taskId}`
      )
      modulePmcTaskId = taskId
      _internalSetPmcResearchTaskId(taskId)
    },
    [_internalSetPmcResearchTaskId]
  ) // Dependency on internal setter

  const setIsPollingPmc = useCallback(
    (polling: boolean | ((prevState: boolean) => boolean)) => {
      _internalSetIsPollingPmc(prevReactState => {
        const newPollingState =
          typeof polling === 'function' ? polling(prevReactState) : polling
        console.log(
          `[usePmcResearchMode] Setting Polling. Module: ${newPollingState}, React State: ${newPollingState}`
        )
        moduleIsPolling = newPollingState
        return newPollingState
      })
    },
    [_internalSetIsPollingPmc]
  ) // Dependency on internal setter

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      Logger.debug(
        `PMC polling stopped via stopPolling for task ID: ${modulePmcTaskId}`
      )
    }
    console.log(
      '[usePmcResearchMode] Setting isPollingPmc to false via stopPolling'
    )
    setIsPollingPmc(false) // This will update moduleIsPolling via wrapper
    setPmcResearchTaskId(null) // This will update modulePmcTaskId via wrapper
  }, [setIsPollingPmc, setPmcResearchTaskId]) // Depend on the wrapper setters

  const checkPmcStatus = useCallback(
    async (taskIdToCheck: string) => {
      // Use modulePmcTaskId for safety inside async callback?
      const currentTask = modulePmcTaskId
      if (!currentTask || taskIdToCheck !== currentTask) {
        Logger.warn(
          `checkPmcStatus called for ${taskIdToCheck} but current module task is ${currentTask}. Stopping poll.`
        )
        stopPolling()
        return
      }

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

        // Check moduleIsPolling again in case stopPolling was called elsewhere
        if (!moduleIsPolling) {
          Logger.warn(
            `Polling flag (module) turned false during status check for ${taskIdToCheck}. Stopping.`
          )
          stopPolling()
          return
        }

        if (statusResponse.status === 'completed') {
          Logger.info(
            `${logPrefix} PMC research completed! Fetching results...`
          )
          const finalResponse = await getPmcResearchResults(taskIdToCheck)
          Logger.debug(`${logPrefix} Results received`, {
            query: finalResponse.query
          })
          setPmcResearchResultData(finalResponse)
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
          setPmcResearchResultData({
            task_id: taskIdToCheck,
            status: 'failed',
            query: 'Unknown',
            message: statusResponse.message || 'Pesquisa PMC falhou.'
          })
          stopPolling()
        }
        // If still processing, do nothing, interval will call again
      } catch (error) {
        Logger.error(
          `${logPrefix} Error during PMC status check/result fetch:`,
          error
        )
        setPmcResearchResultData({
          task_id: taskIdToCheck,
          status: 'failed',
          query: 'Unknown',
          message: `Erro ao buscar status/resultado: ${
            (error as Error).message
          }`
        })
        stopPolling()
      }
    },
    [stopPolling, setPmcResearchResultData] // Depend on stopPolling and setter
  )

  const startPmcResearchTask = useCallback(
    async (query: string): Promise<string> => {
      setPmcResearchResultData(null)
      console.log(
        '[usePmcResearchMode] Setting isPollingPmc to true via startPmcResearchTask'
      )
      setIsPollingPmc(true) // Updates moduleIsPolling via wrapper
      const tempLogId = `pmc-pending-${Date.now()}`
      Logger.info(`[${tempLogId}] Starting PMC research...`, { query })

      try {
        const response = await startPmcResearch(query)
        if (!response?.task_id)
          throw new Error('Backend did not return a task_id for PMC research.')
        setPmcResearchTaskId(response.task_id) // Updates modulePmcTaskId via wrapper
        Logger.info(`[pmc-${response.task_id}] PMC research initiated`, {
          message: response.message,
          taskId: response.task_id
        })
        return response.task_id
      } catch (error) {
        Logger.error(`[${tempLogId}] Failed to start PMC research:`, error)
        console.log(
          '[usePmcResearchMode] Setting isPollingPmc to false due to error in startPmcResearchTask'
        )
        setIsPollingPmc(false) // Updates moduleIsPolling via wrapper
        throw error
      }
    },
    [setPmcResearchResultData, setIsPollingPmc, setPmcResearchTaskId] // Depend on wrapper setters
  )

  // This useEffect sets up and clears the interval based on React state
  useEffect(() => {
    // Clear previous interval if dependencies change
    if (pollingIntervalRef.current) {
      console.log(
        `[usePmcResearchMode Polling useEffect] Clearing previous interval: ${pollingIntervalRef.current}`
      )
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    // Setup new interval only if React state indicates polling should be active
    if (pmcResearchTaskId && isPollingPmc) {
      console.log(
        `[usePmcResearchMode Polling useEffect] Setting up interval for React TaskID: ${pmcResearchTaskId}, React Polling: ${isPollingPmc}`
      )
      pollingIntervalRef.current = window.setInterval(() => {
        // Inside the interval, use the module variable to decide if work should be done
        if (modulePmcTaskId && moduleIsPolling) {
          console.log(
            `[setInterval Callback] Polling active for Module TaskID: ${modulePmcTaskId}. Calling checkPmcStatus.`
          )
          checkPmcStatus(modulePmcTaskId)
        } else {
          console.warn(
            `[setInterval Callback] Conditions not met (Module TaskID: ${modulePmcTaskId}, Module Polling: ${moduleIsPolling}). Stopping interval from inside.`
          )
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          // Also ensure React state reflects the stop if module state dictates it
          _internalSetIsPollingPmc(false)
        }
      }, POLLING_INTERVAL)
    } else {
      console.log(
        `[usePmcResearchMode Polling useEffect] Conditions not met for setting up interval (React TaskID: ${pmcResearchTaskId}, React Polling: ${isPollingPmc}).`
      )
    }

    // Cleanup function remains the same
    return () => {
      console.log(
        `[usePmcResearchMode Polling useEffect Cleanup] Running. Interval ID: ${pollingIntervalRef.current}`
      )
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null // Ensure ref is cleared
        Logger.debug(
          `PMC polling interval cleared for ${
            pmcResearchTaskId || modulePmcTaskId
          } during cleanup.`
        )
      }
    }
    // Dependencies: React state triggers setup/cleanup, checkPmcStatus callback
  }, [
    pmcResearchTaskId,
    isPollingPmc,
    checkPmcStatus,
    _internalSetIsPollingPmc
  ])

  const setIsPmcResearchMode = useCallback(
    (value: boolean | ((prevState: boolean) => boolean)) => {
      _internalSetIsPmcResearchMode(prevState => {
        const newValue = typeof value === 'function' ? value(prevState) : value
        setCookie('search-mode', newValue.toString())
        // If turning PMC mode OFF, stop any active polling
        if (!newValue && moduleIsPolling) {
          console.log(
            '[setIsPmcResearchMode] Mode toggled OFF, stopping polling.'
          )
          stopPolling()
        }
        return newValue
      })
    },
    [_internalSetIsPmcResearchMode, stopPolling] // Added stopPolling dependency
  )

  return {
    isPmcResearchMode,
    setIsPmcResearchMode,
    isPollingPmc,
    pmcResearchTaskId,
    startPmcResearchTask,
    pmcResearchResultData,
    setPmcResearchResultData
  }
}
