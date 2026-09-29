import Foundation
import ActivityKit
import React

// NOTE: this file references `LiveActivityAttributes`, defined in
// widget-template/LiveActivityAttributes.swift. That file is NOT compiled by this pod
// (see the podspec's comment) — you must manually copy it into your main app target
// per the README's "Widget Extension setup" step 3, or this module will fail to compile.

@available(iOS 16.2, *)
@objc(LiveActivities)
class LiveActivities: RCTEventEmitter {

  // Keyed by the ActivityKit-issued activity ID string, so JS can address a specific activity.
  private var runningActivities: [String: Activity<LiveActivityAttributes>] = [:]
  private var pushTokenObservers: [String: Task<Void, Never>] = [:]

  override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    return ["LiveActivities:pushToken"]
  }

  @objc func areActivitiesEnabled(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 16.2, *) {
      resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
    } else {
      resolve(false)
    }
  }

  @objc func startActivity(_ activityName: String,
                            title: String,
                            subtitle: String?,
                            progress: NSNumber?,
                            endDate: NSNumber?,
                            extraDataJson: String?,
                            resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 16.2, *) else {
      reject("UNSUPPORTED", "Live Activities require iOS 16.2+.", nil)
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      reject("DISABLED", "The user has disabled Live Activities for this app (or globally) in Settings.", nil)
      return
    }

    let state = LiveActivityAttributes.ContentState(
      title: title,
      subtitle: subtitle,
      progress: progress?.doubleValue,
      endDate: endDate.map { Date(timeIntervalSince1970: $0.doubleValue / 1000) },
      extraDataJson: extraDataJson
    )
    let attributes = LiveActivityAttributes(activityName: activityName)

    do {
      let activity = try Activity<LiveActivityAttributes>.request(
        attributes: attributes,
        content: .init(state: state, staleDate: nil),
        pushType: .token
      )
      runningActivities[activity.id] = activity
      observePushTokens(for: activity)
      resolve(activity.id)
    } catch {
      reject("START_FAILED", error.localizedDescription, error)
    }
  }

  @objc func updateActivity(_ activityId: String,
                             title: String,
                             subtitle: String?,
                             progress: NSNumber?,
                             endDate: NSNumber?,
                             extraDataJson: String?,
                             resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 16.2, *), let activity = runningActivities[activityId] else {
      reject("NOT_FOUND", "No running activity with id \(activityId). Did the app restart? Activity handles do not survive process relaunch — re-fetch via Activity<LiveActivityAttributes>.activities if you need to reattach.", nil)
      return
    }
    let state = LiveActivityAttributes.ContentState(
      title: title,
      subtitle: subtitle,
      progress: progress?.doubleValue,
      endDate: endDate.map { Date(timeIntervalSince1970: $0.doubleValue / 1000) },
      extraDataJson: extraDataJson
    )
    Task {
      await activity.update(.init(state: state, staleDate: nil))
      resolve(nil)
    }
  }

  @objc func endActivity(_ activityId: String,
                          policy: String,
                          afterDate: NSNumber?,
                          finalTitle: String?,
                          finalSubtitle: String?,
                          finalProgress: NSNumber?,
                          finalEndDate: NSNumber?,
                          finalExtraDataJson: String?,
                          resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 16.2, *), let activity = runningActivities[activityId] else {
      reject("NOT_FOUND", "No running activity with id \(activityId).", nil)
      return
    }

    if policy == "after", afterDate == nil {
      reject("MISSING_AFTER_DATE", "policy 'after' requires an afterDate (Unix epoch millis) — falling back to 'now' would silently dismiss immediately instead of at your intended time.", nil)
      return
    }

    let finalContent: ActivityContent<LiveActivityAttributes.ContentState>? = finalTitle.map { title in
      .init(
        state: .init(
          title: title,
          subtitle: finalSubtitle,
          progress: finalProgress?.doubleValue,
          endDate: finalEndDate.map { Date(timeIntervalSince1970: $0.doubleValue / 1000) },
          extraDataJson: finalExtraDataJson
        ),
        staleDate: nil
      )
    }

    let dismissalPolicy: ActivityUIDismissalPolicy
    switch policy {
    case "immediate": dismissalPolicy = .immediate
    case "after":
      let date = afterDate.map { Date(timeIntervalSince1970: $0.doubleValue / 1000) } ?? Date()
      dismissalPolicy = .after(date)
    default: dismissalPolicy = .default
    }

    Task {
      await activity.end(finalContent, dismissalPolicy: dismissalPolicy)
      runningActivities.removeValue(forKey: activityId)
      pushTokenObservers[activityId]?.cancel()
      pushTokenObservers.removeValue(forKey: activityId)
      resolve(nil)
    }
  }

  @available(iOS 16.2, *)
  private func observePushTokens(for activity: Activity<LiveActivityAttributes>) {
    pushTokenObservers[activity.id] = Task { [weak self] in
      for await tokenData in activity.pushTokenUpdates {
        let tokenHex = tokenData.map { String(format: "%02x", $0) }.joined()
        self?.sendEvent(withName: "LiveActivities:pushToken", body: ["activityId": activity.id, "pushTokenHex": tokenHex])
      }
    }
  }

  // MARK: - Bridge teardown

  /// Cancels JS-event-forwarding tasks when the RN bridge tears down (dev Fast Refresh full reload).
  /// This does NOT end the underlying ActivityKit activities — those are owned by the OS and correctly
  /// keep running (e.g. surviving a JS reload) independent of whether anything is listening on the JS side.
  override func invalidate() {
    for (_, task) in pushTokenObservers {
      task.cancel()
    }
    pushTokenObservers.removeAll()
    super.invalidate()
  }
}
