require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-healthkit-modern"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["repository"]
  s.license      = package["license"]
  s.authors      = { "Your Org" => "oss@yourorg.com" }
  s.platforms    = { ios: "15.1" }
  s.source       = { git: package["repository"], tag: "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.frameworks   = "HealthKit"

  s.dependency "React-Core"
end
