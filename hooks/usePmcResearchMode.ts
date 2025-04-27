import { AppState, useAppStore } from '@/lib/store' // Correct path and import AppState type
import { useCallback, useEffect, useRef, useState } from 'react'
import { Logger } from '../lib/logger'
import {
  getPmcResearchResults,
  getPmcResearchStatus,
  startPmcResearch
} from '../lib/pmc_researchApi'
import type { PmcResearchResultResponse } from '../types/pmc_research'

// Module-level variables might still be useful for polling robustness
let modulePmcTaskId: string | null = null
let moduleIsPolling: boolean = false

const POLLING_INTERVAL = 5000

export interface UsePmcResearchModeResult {
  // isPmcResearchMode: boolean // Get from store directly
  // setIsPmcResearchMode: (value: boolean | ((prevState: boolean) => boolean)) => void // Use store action
  isPollingPmc: boolean
  pmcResearchTaskId: string | null
  startPmcResearchTask: (query: string) => Promise<string>
  pmcResearchResultData: PmcResearchResultResponse | null
  setPmcResearchResultData: React.Dispatch<
    React.SetStateAction<PmcResearchResultResponse | null>
  >
  // Removed setIsPmcResearchMode from return as it's now handled by the store
}

export function usePmcResearchMode(): UsePmcResearchModeResult {
  console.log(
    `!!!!!! usePmcResearchMode Hook Initializing/Re-running !!!!!! Module Task ID: ${modulePmcTaskId}, Module Polling: ${moduleIsPolling}`
  )

  // Get state and actions from Zustand store
  // Note: We don't select isPmcResearchMode here directly to avoid re-renders if only that changes
  // Components that need it will select it themselves.
  const storeSetIsPmcResearchMode = useAppStore(
    (state: AppState) => state.setIsPmcResearchMode
  )

  // State managed by this hook (polling and results)
  const [pmcResearchTaskId, _internalSetPmcResearchTaskId] = useState<
    string | null
  >(modulePmcTaskId)
  const [isPollingPmc, _internalSetIsPollingPmc] =
    useState<boolean>(moduleIsPolling)
  const [pmcResearchResultData, setPmcResearchResultData] =
    useState<PmcResearchResultResponse | null>(null)
  const pollingIntervalRef = useRef<number | null>(null)

  // Wrapper setters still useful for module variables
  const setPmcResearchTaskId = useCallback(
    (taskId: string | null) => {
      console.log(
        `[usePmcResearchMode] Setting Task ID. Module: ${taskId}, React State: ${taskId}`
      )
      modulePmcTaskId = taskId
      _internalSetPmcResearchTaskId(taskId)
    },
    [_internalSetPmcResearchTaskId]
  )

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
  )

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
    setIsPollingPmc(false)
    setPmcResearchTaskId(null)
  }, [setIsPollingPmc, setPmcResearchTaskId])

  // checkPmcStatus remains largely the same, using module variables and setters
  const checkPmcStatus = useCallback(
    async (taskIdToCheck: string) => {
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
            query: 'Unknown', // TODO: Maybe get query from somewhere else?
            message: statusResponse.message || 'Pesquisa PMC falhou.'
          })
          stopPolling()
        }
      } catch (error) {
        Logger.error(
          `${logPrefix} Error during PMC status check/result fetch:`,
          error
        )
        setPmcResearchResultData({
          task_id: taskIdToCheck,
          status: 'failed',
          query: 'Unknown', // TODO: Maybe get query from somewhere else?
          message: `Erro ao buscar status/resultado: ${
            (error as Error).message
          }`
        })
        stopPolling()
      }
    },
    [stopPolling, setPmcResearchResultData] // Depend on stopPolling and setter
  )

  // startPmcResearchTask remains the same
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

  // Polling useEffect remains the same, using module variables and local state
  useEffect(() => {
    if (pollingIntervalRef.current) {
      console.log(
        `[usePmcResearchMode Polling useEffect] Clearing previous interval: ${pollingIntervalRef.current}`
      )
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    if (pmcResearchTaskId && isPollingPmc) {
      console.log(
        `[usePmcResearchMode Polling useEffect] Setting up interval for React TaskID: ${pmcResearchTaskId}, React Polling: ${isPollingPmc}`
      )
      pollingIntervalRef.current = window.setInterval(() => {
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
          _internalSetIsPollingPmc(false)
        }
      }, POLLING_INTERVAL)
    } else {
      console.log(
        `[usePmcResearchMode Polling useEffect] Conditions not met for setting up interval (React TaskID: ${pmcResearchTaskId}, React Polling: ${isPollingPmc}).`
      )
    }

    return () => {
      console.log(
        `[usePmcResearchMode Polling useEffect Cleanup] Running. Interval ID: ${pollingIntervalRef.current}`
      )
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
        Logger.debug(
          `PMC polling interval cleared for ${
            pmcResearchTaskId || modulePmcTaskId
          } during cleanup.`
        )
      }
    }
  }, [
    pmcResearchTaskId,
    isPollingPmc,
    checkPmcStatus,
    _internalSetIsPollingPmc
  ])

  // Removed the useCallback for setIsPmcResearchMode - use store action directly

  return {
    // isPmcResearchMode, // Removed - get from store
    // setIsPmcResearchMode, // Removed - use store action
    isPollingPmc,
    pmcResearchTaskId,
    startPmcResearchTask,
    pmcResearchResultData,
    setPmcResearchResultData
  }
}
