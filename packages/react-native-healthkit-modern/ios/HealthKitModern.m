#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(HealthKitModern, RCTEventEmitter)

RCT_EXTERN_METHOD(isHealthDataAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestAuthorization:(NSArray *)readIdentifiers
                  writeIdentifiers:(NSArray *)writeIdentifiers
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getWriteAuthorizationStatus:(NSString *)identifier
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(queryQuantitySamples:(NSString *)identifier
                  startDate:(double)startDate
                  endDate:(double)endDate
                  limit:(NSInteger)limit
                  ascending:(BOOL)ascending
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(queryCategorySamples:(NSString *)identifier
                  startDate:(double)startDate
                  endDate:(double)endDate
                  limit:(NSInteger)limit
                  ascending:(BOOL)ascending
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startObserverQuery:(NSString *)identifier)
RCT_EXTERN_METHOD(stopObserverQuery:(NSString *)identifier)

RCT_EXTERN_METHOD(enableBackgroundDelivery:(NSString *)identifier
                  frequency:(NSString *)frequency
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
