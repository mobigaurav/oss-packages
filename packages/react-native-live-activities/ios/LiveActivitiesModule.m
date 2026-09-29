#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(LiveActivities, RCTEventEmitter)

RCT_EXTERN_METHOD(areActivitiesEnabled:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startActivity:(NSString *)activityName
                  title:(NSString *)title
                  subtitle:(NSString *)subtitle
                  progress:(NSNumber *)progress
                  endDate:(NSNumber *)endDate
                  extraDataJson:(NSString *)extraDataJson
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateActivity:(NSString *)activityId
                  title:(NSString *)title
                  subtitle:(NSString *)subtitle
                  progress:(NSNumber *)progress
                  endDate:(NSNumber *)endDate
                  extraDataJson:(NSString *)extraDataJson
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endActivity:(NSString *)activityId
                  policy:(NSString *)policy
                  afterDate:(NSNumber *)afterDate
                  finalTitle:(NSString *)finalTitle
                  finalSubtitle:(NSString *)finalSubtitle
                  finalProgress:(NSNumber *)finalProgress
                  finalEndDate:(NSNumber *)finalEndDate
                  finalExtraDataJson:(NSString *)finalExtraDataJson
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
