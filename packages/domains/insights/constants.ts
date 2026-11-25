export const INSIGHTS_PERIODS = [7, 30] as const;

export const INSIGHTS_PERIOD_ERROR = `days must be one of ${INSIGHTS_PERIODS.join(', ')}`;
