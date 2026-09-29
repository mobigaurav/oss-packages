/** Quantity sample types this package knows how to read/write. Extend as needed. */
export type HKQuantityTypeIdentifier =
  | 'stepCount'
  | 'heartRate'
  | 'activeEnergyBurned'
  | 'restingHeartRate'
  | 'heartRateVariabilitySDNN'
  | 'oxygenSaturation'
  | 'bodyMass'
  | 'cyclingFunctionalThresholdPower'; // iOS 17+

/**
 * Category samples — distinct API shape from HKQuantitySample (`value` is a raw
 * HKCategoryValue* enum integer, not a physical quantity). `sleepAnalysis` is a category
 * type in HealthKit itself (HKCategoryTypeIdentifier), not a quantity type — a common
 * mistake when porting from other wrappers, so it's called out here explicitly.
 */
export type HKCategoryTypeIdentifier = 'stateOfMind' | 'mindfulSession' | 'sleepAnalysis'; // stateOfMind is iOS 17+

export interface HealthAuthorizationRequest {
  read: Array<HKQuantityTypeIdentifier | HKCategoryTypeIdentifier>;
  write: Array<HKQuantityTypeIdentifier | HKCategoryTypeIdentifier>;
}

export interface HKQuantitySample {
  uuid: string;
  /** Unix epoch millis. */
  startDate: number;
  endDate: number;
  /** Value in the unit implied by `identifier` — see README's unit table. */
  value: number;
  identifier: HKQuantityTypeIdentifier;
  sourceName?: string;
  /** Human-readable device name (e.g. "Apple Watch"), when HealthKit recorded one. */
  device?: string;
}

export interface HKCategorySample {
  uuid: string;
  startDate: number;
  endDate: number;
  /**
   * Raw HKCategoryValue integer as defined by HealthKit for this identifier. For
   * `sleepAnalysis` see `HKCategoryValueSleepAnalysis` (0 = inBed, 1 = asleepUnspecified,
   * 2 = awake, 3 = asleepCore, 4 = asleepDeep, 5 = asleepREM). For `mindfulSession` the
   * value is always 0. For `stateOfMind` see `HKCategoryValueStateOfMindValence` — refer
   * to Apple's docs, this package returns the raw int rather than re-modeling every enum.
   */
  value: number;
  identifier: HKCategoryTypeIdentifier;
}

export interface QueryOptions {
  startDate: number;
  endDate: number;
  /** Defaults to 100. Pass 0 for "no limit" (HealthKit's HKObjectQueryNoLimit). */
  limit?: number;
  ascending?: boolean;
}

export type ObserverCallback = (identifier: HKQuantityTypeIdentifier) => void;
