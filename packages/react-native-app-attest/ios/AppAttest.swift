import Foundation
import DeviceCheck
import CryptoKit
import React

@objc(AppAttest)
class AppAttest: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func isSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 14.0, *) {
      resolve(DCAppAttestService.shared.isSupported)
    } else {
      resolve(false)
    }
  }

  @objc func generateKey(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 14.0, *) else {
      reject("UNSUPPORTED", "App Attest requires iOS 14+.", nil)
      return
    }
    DCAppAttestService.shared.generateKey { keyId, error in
      if let error = error {
        reject("KEYGEN_FAILED", error.localizedDescription, error)
        return
      }
      resolve(keyId)
    }
  }

  @objc func attestKey(_ keyId: String,
                        challengeBase64: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 14.0, *) else {
      reject("UNSUPPORTED", "App Attest requires iOS 14+.", nil)
      return
    }
    guard let challenge = Data(base64Encoded: challengeBase64) else {
      reject("BAD_CHALLENGE", "challengeBase64 is not valid base64.", nil)
      return
    }
    // Apple requires the client data hash, not the raw challenge, to be attested.
    let clientDataHash = Data(SHA256.hash(data: challenge))

    DCAppAttestService.shared.attestKey(keyId, clientDataHash: clientDataHash) { attestationObject, error in
      if let error = error {
        reject("ATTEST_FAILED", error.localizedDescription, error)
        return
      }
      resolve(attestationObject?.base64EncodedString())
    }
  }

  @objc func generateAssertion(_ keyId: String,
                                clientDataHashBase64: String,
                                resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 14.0, *) else {
      reject("UNSUPPORTED", "App Attest requires iOS 14+.", nil)
      return
    }
    guard let clientDataHash = Data(base64Encoded: clientDataHashBase64) else {
      reject("BAD_HASH", "clientDataHashBase64 is not valid base64.", nil)
      return
    }
    DCAppAttestService.shared.generateAssertion(keyId, clientDataHash: clientDataHash) { assertion, error in
      if let error = error {
        reject("ASSERTION_FAILED", error.localizedDescription, error)
        return
      }
      resolve(assertion?.base64EncodedString())
    }
  }
}
