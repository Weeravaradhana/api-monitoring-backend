export interface MonitorEventPayload {
  monitorId: string;
  url: string;
  name: string;
  statusCode: number | null;
  errorMessage: string | null;
}
