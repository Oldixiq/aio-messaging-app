/** A notification a service emitted, kept in memory only (never written to disk). */
export interface NotificationRecord {
  key: string;
  instanceId: string;
  /** Usually the sender or conversation name, as the service provides it. */
  title: string;
  body: string;
  at: number;
  /** Whether a Windows toast was shown, and if not, why. */
  delivery: 'shown' | 'muted' | 'service-muted' | 'focused' | 'rate-limited';
}
