/**
 * Adapter registry — all registered source adapters.
 *
 * Order matters for the deadline budget: adapters listed first
 * get priority when the cron is close to timing out.
 * RemoteOK is listed first as the primary phase 1 source.
 */

import { remoteOKAdapter } from './remoteok'
import { wwrAdapter } from './wwr'
import { himalayasAdapter } from './himalayas'
import type { SourceAdapter } from '../types'

export const ADAPTERS: SourceAdapter[] = [
  remoteOKAdapter,
  wwrAdapter,
  himalayasAdapter,
  // workingnomadsAdapter — phase 2 (add here when implemented)
]

export { remoteOKAdapter, wwrAdapter, himalayasAdapter }
