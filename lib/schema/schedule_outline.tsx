import { DeepPartial } from 'ai'
import { z } from 'zod'

export const scheduleOutlineSchema = z.object({
  subject: z.string().describe('The subject of the study plan'),
  topics: z.string().describe('Topics to be covered in the study plan'),
  scheduledTimes: z.array(
    z.object({
      day: z.number().describe('Day number of the study plan'),
      label: z.string().describe('Description for the day'),
      sessions: z.array(
        z.object({
          time: z.string().describe('Time slot for the session'),
          label: z.string().optional().describe('Description for the session'),
          hours: z.array(
            z.object({
              hour: z.number().describe('Hour number within the session'),
              label: z.string().describe('Description for the hour')
            })
          ).describe('List of hours within the session')
        })
      ).describe('List of sessions for the day')
    })
  ).describe('Scheduled study times'),
  additionalTips: z.array(
    z.object({
      tip: z.string().describe('Tip for enhancing study effectiveness'),
      details: z.string().describe('Details about the tip')
    })
  ).describe('Additional tips for the study plan'),
  dynamicSessions: z.array(
    z.object({
      value: z.string().describe('Value of the dynamic session'),
      label: z.string().describe('Label for the dynamic session')
    })
  ).describe('List of dynamic session options')
});

export type PartialInquiry = DeepPartial<typeof scheduleOutlineSchema>

