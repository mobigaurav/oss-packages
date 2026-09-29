import Foundation
import HealthKit
import React

@objc(HealthKitModern)
class HealthKitModern: RCTEventEmitter {

  private let healthStore = HKHealthStore()
  private var activeObservers: [String: HKObserverQuery] = [:]

  override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    return ["HealthKitModern:update"]
  }

  // MARK: - Identifier mapping
  // Extend this table alongside types.ts whenever you add a new identifier.
  private static let quantityTypes: [String: HKQuantityTypeIdentifier] = [
    "stepCount": .stepCount,
    "heartRate": .heartRate,
    "activeEnergyBurned": .activeEnergyBurned,
    "restingHeartRate": .restingHeartRate,
    "heartRateVariabilitySDNN": .heartRateVariabilitySDNN,
    "oxygenSaturation": .oxygenSaturation,
    "bodyMass": .bodyMass,
  ]

  private func quantityType(for identifier: String) -> HKQuantityType? {
    if identifier == "cyclingFunctionalThresholdPower", #available(iOS 17.0, *) {
      return HKQuantityType.quantityType(forIdentifier: .cyclingFunctionalThresholdPower)
    }
    guard let id = Self.quantityTypes[identifier] else { return nil }
    return HKQuantityType.quantityType(forIdentifier: id)
  }

  private func categoryType(for identifier: String) -> HKCategoryType? {
    switch identifier {
    case "mindfulSession":
      return HKCategoryType.categoryType(forIdentifier: .mindfulSession)
    case "sleepAnalysis":
      return HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)
    case "stateOfMind":
      if #available(iOS 17.0, *) {
        return HKCategoryType.categoryType(forIdentifier: .stateOfMind)
      }
      return nil
    default:
      return nil
    }
  }

  private func unit(for identifier: String) -> HKUnit {
    switch identifier {
    case "stepCount": return .count()
    case "heartRate", "restingHeartRate": return HKUnit.count().unitDivided(by: .minute())
    case "activeEnergyBurned": return .kilocalorie()
    case "heartRateVariabilitySDNN": return HKUnit.secondUnit(with: .milli)
    case "oxygenSaturation": return .percent()
    case "bodyMass": return .gramUnit(with: .kilo)
    case "cyclingFunctionalThresholdPower": return HKUnit.watt()
    default: return .count()
    }
  }

  // MARK: - Availability & Authorization

  @objc func isHealthDataAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(HKHealthStore.isHealthDataAvailable())
  }

  @objc func requestAuthorization(_ readIdentifiers: [String],
                                   writeIdentifiers: [String],
                                   resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      reject("UNAVAILABLE", "Health data is not available on this device.", nil)
      return
    }

    var readTypes = Set<HKObjectType>()
    var writeTypes = Set<HKSampleType>()
    var unknownIdentifiers: [String] = []

    for id in readIdentifiers {
      if let qt = quantityType(for: id) { readTypes.insert(qt) }
      else if let ct = categoryType(for: id) { readTypes.insert(ct) }
      else { unknownIdentifiers.append(id) }
    }
    for id in writeIdentifiers {
      if let qt = quantityType(for: id) { writeTypes.insert(qt) }
      else if let ct = categoryType(for: id) { writeTypes.insert(ct) }
      else { unknownIdentifiers.append(id) }
    }

    // Fail loudly on typos/unsupported identifiers instead of silently requesting a smaller
    // set than the caller intended — that failure mode is very hard to debug from JS.
    guard unknownIdentifiers.isEmpty else {
      reject("UNKNOWN_IDENTIFIER", "Unknown or unavailable identifier(s) on this OS version: \(unknownIdentifiers.joined(separator: ", "))", nil)
      return
    }

    healthStore.requestAuthorization(toShare: writeTypes, read: readTypes) { success, error in
      if let error = error {
        reject("AUTH_FAILED", error.localizedDescription, error)
      } else {
        resolve(nil)
      }
    }
  }

  /**
   * HealthKit only reports a meaningful authorization status for WRITE (share) types.
   * For READ types, Apple's privacy design means this always reports `.notDetermined` or
   * `.sharingDenied` even after the user grants read access — querying is the only reliable
   * way to know if you actually got read data back. See the README's "Known limitations".
   */
  @objc func getWriteAuthorizationStatus(_ identifier: String,
                                          resolve: @escaping RCTPromiseResolveBlock,
                                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    let type: HKObjectType?
    if let qt = quantityType(for: identifier) { type = qt }
    else if let ct = categoryType(for: identifier) { type = ct }
    else { type = nil }

    guard let resolvedType = type else {
      reject("UNKNOWN_IDENTIFIER", "Unknown or unavailable identifier on this OS version: \(identifier)", nil)
      return
    }

    switch healthStore.authorizationStatus(for: resolvedType) {
    case .notDetermined: resolve("notDetermined")
    case .sharingDenied: resolve("denied")
    case .sharingAuthorized: resolve("authorized")
    @unknown default: resolve("notDetermined")
    }
  }

  // MARK: - Queries

  @objc func queryQuantitySamples(_ identifier: String,
                                   startDate: Double,
                                   endDate: Double,
                                   limit: Int,
                                   ascending: Bool,
                                   resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let type = quantityType(for: identifier) else {
      reject("UNKNOWN_TYPE", "Unknown quantity type identifier: \(identifier)", nil)
      return
    }
    let predicate = HKQuery.predicateForSamples(
      withStart: Date(timeIntervalSince1970: startDate / 1000),
      end: Date(timeIntervalSince1970: endDate / 1000),
      options: .strictStartDate
    )
    let sort = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: ascending)]
    let effectiveLimit = limit == 0 ? HKObjectQueryNoLimit : limit

    let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: effectiveLimit, sortDescriptors: sort) { [weak self] _, samples, error in
      guard let self = self else { return }
      if let error = error {
        reject("QUERY_FAILED", error.localizedDescription, error)
        return
      }
      let unit = self.unit(for: identifier)
      let result = (samples as? [HKQuantitySample] ?? []).map { sample -> [String: Any] in
        [
          "uuid": sample.uuid.uuidString,
          "startDate": sample.startDate.timeIntervalSince1970 * 1000,
          "endDate": sample.endDate.timeIntervalSince1970 * 1000,
          "value": sample.quantity.doubleValue(for: unit),
          "identifier": identifier,
          "sourceName": sample.sourceRevision.source.name,
          "device": sample.device?.name as Any,
        ]
      }
      resolve(result)
    }
    healthStore.execute(query)
  }

  @objc func queryCategorySamples(_ identifier: String,
                                   startDate: Double,
                                   endDate: Double,
                                   limit: Int,
                                   ascending: Bool,
                                   resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let type = categoryType(for: identifier) else {
      reject("UNKNOWN_TYPE", "Unknown or unavailable category type: \(identifier) (stateOfMind requires iOS 17+)", nil)
      return
    }
    let predicate = HKQuery.predicateForSamples(
      withStart: Date(timeIntervalSince1970: startDate / 1000),
      end: Date(timeIntervalSince1970: endDate / 1000),
      options: .strictStartDate
    )
    let sort = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: ascending)]
    let effectiveLimit = limit == 0 ? HKObjectQueryNoLimit : limit

    let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: effectiveLimit, sortDescriptors: sort) { _, samples, error in
      if let error = error {
        reject("QUERY_FAILED", error.localizedDescription, error)
        return
      }
      let result = (samples as? [HKCategorySample] ?? []).map { sample -> [String: Any] in
        [
          "uuid": sample.uuid.uuidString,
          "startDate": sample.startDate.timeIntervalSince1970 * 1000,
          "endDate": sample.endDate.timeIntervalSince1970 * 1000,
          "value": sample.value,
          "identifier": identifier,
        ]
      }
      resolve(result)
    }
    healthStore.execute(query)
  }

  // MARK: - Observers / background delivery

  @objc func startObserverQuery(_ identifier: String) {
    guard let type = quantityType(for: identifier), activeObservers[identifier] == nil else { return }
    let query = HKObserverQuery(sampleType: type, predicate: nil) { [weak self] _, completionHandler, error in
      if error == nil {
        self?.sendEvent(withName: "HealthKitModern:update", body: ["identifier": identifier])
      }
      completionHandler()
    }
    activeObservers[identifier] = query
    healthStore.execute(query)
  }

  @objc func stopObserverQuery(_ identifier: String) {
    guard let query = activeObservers[identifier] else { return }
    healthStore.stop(query)
    activeObservers.removeValue(forKey: identifier)
  }

  @objc func enableBackgroundDelivery(_ identifier: String,
                                       frequency: String,
                                       resolve: @escaping RCTPromiseResolveBlock,
                                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let type = quantityType(for: identifier) else {
      reject("UNKNOWN_TYPE", "Unknown quantity type identifier: \(identifier)", nil)
      return
    }
    let hkFrequency: HKUpdateFrequency
    switch frequency {
    case "hourly": hkFrequency = .hourly
    case "daily": hkFrequency = .daily
    default: hkFrequency = .immediate
    }
    healthStore.enableBackgroundDelivery(for: type, frequency: hkFrequency) { success, error in
      if let error = error {
        reject("BG_DELIVERY_FAILED", error.localizedDescription, error)
      } else {
        resolve(nil)
      }
    }
  }

  // MARK: - Bridge teardown

  /// Stops every active HKObserverQuery when the RN bridge is torn down (dev Fast Refresh full
  /// reload, or app backgrounding on some RN versions) so we don't leak native queries or keep
  /// firing events into a dead JS context.
  override func invalidate() {
    for (_, query) in activeObservers {
      healthStore.stop(query)
    }
    activeObservers.removeAll()
    super.invalidate()
  }
}
