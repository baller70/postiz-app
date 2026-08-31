export const EXPIRING_SOON_DAYS = 14;

export type ConnectionStatus =
  | 'connected'
  | 'reconnect'
  | 'disabled'
  | 'expiring';

export interface ConnectionStatusInput {
  disabled?: boolean;
  refreshNeeded?: boolean;
  inBetweenSteps?: boolean;
  tokenExpiration?: string | null;
}

export function getConnectionStatus(
  integration: ConnectionStatusInput,
  now = Date.now()
): ConnectionStatus {
  if (integration.disabled) {
    return 'disabled';
  }

  if (integration.refreshNeeded || integration.inBetweenSteps) {
    return 'reconnect';
  }

  if (integration.tokenExpiration) {
    const expiration = new Date(integration.tokenExpiration).getTime();
    if (!Number.isNaN(expiration)) {
      if (expiration <= now) {
        return 'reconnect';
      }

      const expiringSoon = now + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
      if (expiration <= expiringSoon) {
        return 'expiring';
      }
    }
  }

  return 'connected';
}

export function isConnectionAttention(status: ConnectionStatus) {
  return status === 'reconnect' || status === 'expiring';
}
