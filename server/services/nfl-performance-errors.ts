export class NflPerformanceServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "NflPerformanceServiceError";
  }
}
