import { initBotId } from 'botid/client/core'

import {
  BOT_PROTECTED_ROUTES,
  isBotProtectionEnabled
} from '@/lib/bot-protection'

if (isBotProtectionEnabled()) {
  initBotId({ protect: BOT_PROTECTED_ROUTES })
}
