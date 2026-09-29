require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-live-activities"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["repository"]
  s.license      = package["license"]
  s.authors      = { "Your Org" => "oss@yourorg.com" }
  # Consumers can keep an iOS 15.1 deployment target. ActivityKit calls are
  # runtime-gated to iOS 16.2+ in Swift, and the framework is weak-linked.
  s.platforms    = { ios: "15.1" }
  s.source       = { git: package["repository"], tag: "v#{s.version}" }
  s.module_name  = "RNLiveActivities"

  # Add this pod to both the main app and Widget Extension targets. The exported
  # LiveActivityAttributes contract is compiled into the shared pod module;
  # widget-template/ only contains the app-specific SwiftUI presentation.
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.weak_frameworks = "ActivityKit"
  s.frameworks      = "WidgetKit"

  s.dependency "React-Core"
end
