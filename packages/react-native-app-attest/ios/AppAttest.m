#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppAttest, NSObject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(generateKey:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(attestKey:(NSString *)keyId
                  challengeBase64:(NSString *)challengeBase64
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(generateAssertion:(NSString *)keyId
                  clientDataHashBase64:(NSString *)clientDataHashBase64
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
