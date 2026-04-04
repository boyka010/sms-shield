// ─────────────────────────────────────────────────────────────────────────────
// SMS-Shield — Automation Module Exports
// ─────────────────────────────────────────────────────────────────────────────

export * from './types';
export {
  AutomationStateMachine,
  getStateMachine,
  DEFAULT_CONFIGS,
  buildTransitionMap,
  mergeTransitionMaps,
} from './state-machine';
