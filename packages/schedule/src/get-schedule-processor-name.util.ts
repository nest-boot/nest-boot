export const getScheduleProcessorName = (
  // eslint-disable-next-line @typescript-eslint/ban-types
  target: Object,
  propertyKey: string,
) => `schedule#${target.constructor.name}#${propertyKey}`;
