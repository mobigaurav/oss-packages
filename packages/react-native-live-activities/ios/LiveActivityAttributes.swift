import ActivityKit
import Foundation

/**
 * The shared ActivityKit contract between the React Native bridge and widget extension.
 *
 * The consuming app must add this pod to both the main app and Widget Extension targets,
 * then import `RNLiveActivities` from the extension. Keeping the attributes type in the
 * pod avoids the fragile "manually copy two identical Swift files" approach: both targets
 * compile against the exact same Codable type and module-qualified identity.
 */
@available(iOS 16.2, *)
public struct LiveActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var title: String
    public var subtitle: String?
    public var progress: Double?
    public var endDate: Date?
    public var extraDataJson: String?

    public init(title: String, subtitle: String? = nil, progress: Double? = nil, endDate: Date? = nil, extraDataJson: String? = nil) {
      self.title = title
      self.subtitle = subtitle
      self.progress = progress
      self.endDate = endDate
      self.extraDataJson = extraDataJson
    }
  }

  public var activityName: String

  public init(activityName: String) {
    self.activityName = activityName
  }
}
