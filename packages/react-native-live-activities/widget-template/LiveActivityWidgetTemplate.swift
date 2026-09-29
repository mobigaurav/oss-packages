import WidgetKit
import SwiftUI
import ActivityKit
import RNLiveActivities

// Copy this file into your Widget Extension target (Xcode → New Target → Widget Extension,
// then replace its generated Widget.swift with this, adjusted to your design). It is NOT part
// of the npm package's compiled output — Live Activities require an actual Widget Extension
// target to exist in your Xcode project; this cannot be injected purely via CocoaPods/npm.
//
// See the package README's "Widget Extension setup" section for the full step-by-step.

struct LiveActivityWidgetTemplate: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      // Lock screen / banner presentation.
      VStack(alignment: .leading, spacing: 4) {
        Text(context.state.title)
          .font(.headline)
        if let subtitle = context.state.subtitle {
          Text(subtitle)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        if let progress = context.state.progress {
          ProgressView(value: progress)
        }
        if let endDate = context.state.endDate {
          Text(endDate, style: .timer)
            .font(.caption)
            .monospacedDigit()
        }
      }
      .padding()
      .activityBackgroundTint(Color.black.opacity(0.8))
      .activitySystemActionForegroundColor(Color.white)

    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.state.title)
            .font(.caption)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let endDate = context.state.endDate {
            Text(endDate, style: .timer)
              .font(.caption2)
              .monospacedDigit()
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          if let progress = context.state.progress {
            ProgressView(value: progress)
          }
        }
      } compactLeading: {
        Text(context.state.title.prefix(1))
      } compactTrailing: {
        if let progress = context.state.progress {
          ProgressView(value: progress)
            .progressViewStyle(.circular)
        }
      } minimal: {
        if let progress = context.state.progress {
          ProgressView(value: progress)
            .progressViewStyle(.circular)
        } else {
          Text(context.state.title.prefix(1))
        }
      }
    }
  }
}
