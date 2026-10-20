export type AuditEvent = {
  id: string;
  orderId: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};
