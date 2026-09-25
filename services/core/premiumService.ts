import { premiumRepository } from "@/repositories/core/premiumRepository";
import { Platform } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

export interface RevenueCatPackage {
  id: string;
  type: "monthly" | "annual";
  priceString: string;
  price: number;
  hasFreeTrial: boolean;
  trialDurationText?: string;
  isTrialEligible: boolean;
}

// Ensure you replace these with your actual RevenueCat API keys or configure in .env
const API_KEYS = {
  apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || "appl_YOUR_APPLE_API_KEY",
  google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || "goog_YOUR_GOOGLE_API_KEY",
};

let isPurchaseInProgress = false;
let isRestoreInProgress = false;

export const premiumService = {
  async initialize() {
    try {
      if (Platform.OS === 'ios') {
        if (!API_KEYS.apple || API_KEYS.apple.includes("YOUR_APPLE_API_KEY")) {
          console.warn("⚠️ RevenueCat Apple API Key is missing. Purchases will not work.");
          return;
        }
        Purchases.configure({ apiKey: API_KEYS.apple });
      } else if (Platform.OS === 'android') {
        if (!API_KEYS.google || API_KEYS.google.includes("YOUR_GOOGLE_API_KEY")) {
          console.warn("⚠️ RevenueCat Google API Key is missing. Purchases will not work.");
          return;
        }
        Purchases.configure({ apiKey: API_KEYS.google });
      }
    } catch (error) {
      console.warn("⚠️ Failed to initialize RevenueCat:", error);
    }
  },

  async fetchOfferings(userId?: string): Promise<RevenueCatPackage[]> {
    try {
      if (userId) {
        try {
          const currentInfo = await Purchases.getCustomerInfo();
          if (currentInfo.originalAppUserId.startsWith("$RCAnonymousID") || currentInfo.originalAppUserId !== userId) {
            await Purchases.logIn(userId);
          }
        } catch (e) {
          console.warn("⚠️ Failed to sync user ID before fetching offerings:", e);
        }
      }

      let customerInfo: any = null;
      try {
        customerInfo = await Purchases.getCustomerInfo();
      } catch (e) {
        console.warn("⚠️ Failed to get customer info for trial check:", e);
      }

      // Check if user has previously purchased or completed a trial/subscription
      const hasPriorPurchases = Boolean(
        customerInfo && (
          (customerInfo.allPurchasedProductIdentifiers && customerInfo.allPurchasedProductIdentifiers.length > 0) ||
          (customerInfo.entitlements?.all && Object.keys(customerInfo.entitlements.all).length > 0) ||
          (customerInfo.subscriptionsByProductIdentifier && Object.keys(customerInfo.subscriptionsByProductIdentifier).length > 0)
        )
      );

      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        const productIds = offerings.current.availablePackages.map((pkg) => pkg.product.identifier);
        let eligibilityMap: Record<string, { status: number; description?: string }> = {};

        try {
          eligibilityMap = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
        } catch (e) {
          // Introductory eligibility check might not be supported on all platforms (e.g. Android)
        }

        return offerings.current.availablePackages.map((pkg: PurchasesPackage) => {
          const isAnnual = pkg.packageType === "ANNUAL" || pkg.identifier.includes("annual");

          let hasFreeTrial = false;
          let trialDurationText = "7-Day";

          // Check if package has free trial configured on store
          if (pkg.product.introPrice && pkg.product.introPrice.price === 0) {
            hasFreeTrial = true;
            if (pkg.product.introPrice.periodNumberOfUnits && pkg.product.introPrice.periodUnit) {
              const unit = pkg.product.introPrice.periodUnit.toLowerCase();
              trialDurationText = `${pkg.product.introPrice.periodNumberOfUnits}-${unit.charAt(0).toUpperCase() + unit.slice(1)}`;
            }
          } else if ((pkg.product as any).defaultOption?.freePhase) {
            hasFreeTrial = true;
          } else if (isAnnual) {
            // Default annual fallback assumption if store hasn't returned detailed introPrice in mock/sandbox
            hasFreeTrial = true;
          }

          // Compute user eligibility:
          // INTRO_ELIGIBILITY_STATUS: 1 = INELIGIBLE, 2 = ELIGIBLE, 3 = NO_INTRO_OFFER_EXISTS, 0 = UNKNOWN
          const eligibility = eligibilityMap[pkg.product.identifier];
          let isTrialEligible = false;

          if (hasFreeTrial) {
            if (eligibility && typeof eligibility.status === "number") {
              if (eligibility.status === 2) {
                // Explicitly ELIGIBLE according to StoreKit
                isTrialEligible = true;
              } else if (eligibility.status === 1 || eligibility.status === 3) {
                // Explicitly INELIGIBLE or NO INTRO OFFER
                isTrialEligible = false;
              } else {
                // UNKNOWN status (e.g. Android): fallback to customer purchase history
                isTrialEligible = !hasPriorPurchases;
              }
            } else {
              // Fallback when eligibility map is not returned (e.g. Android)
              isTrialEligible = !hasPriorPurchases;
            }
          }

          return {
            id: pkg.identifier,
            type: isAnnual ? "annual" : "monthly",
            priceString: pkg.product.priceString,
            price: pkg.product.price,
            hasFreeTrial,
            trialDurationText,
            isTrialEligible,
          };
        });
      }

      // Fallback offerings (for demo/offline/unconfigured RevenueCat sandbox)
      return [
        {
          id: "replix_annual",
          type: "annual",
          priceString: "$29.99",
          price: 29.99,
          hasFreeTrial: true,
          trialDurationText: "7-Day",
          isTrialEligible: !hasPriorPurchases,
        },
        {
          id: "replix_monthly",
          type: "monthly",
          priceString: "$4.99",
          price: 4.99,
          hasFreeTrial: false,
          isTrialEligible: false,
        },
      ];
    } catch (e) {
      console.warn("⚠️ Error fetching RevenueCat offerings, using fallback plans:", e);
      return [
        {
          id: "replix_annual",
          type: "annual",
          priceString: "$29.99",
          price: 29.99,
          hasFreeTrial: true,
          trialDurationText: "7-Day",
          isTrialEligible: true,
        },
        {
          id: "replix_monthly",
          type: "monthly",
          priceString: "$4.99",
          price: 4.99,
          hasFreeTrial: false,
          isTrialEligible: false,
        },
      ];
    }
  },

  async purchasePackage(packageId: string, userId: string): Promise<boolean> {
    if (isPurchaseInProgress) {
      console.warn("[premiumService] Purchase already in progress. Ignoring duplicate call.");
      return false;
    }
    isPurchaseInProgress = true;

    try {
      if (!userId) {
        throw new Error("User ID is required for purchase");
      }

      // Pre-Purchase Guard: Ensure RevenueCat is synced to the actual user
      try {
        const info = await Purchases.getCustomerInfo();
        if (info.originalAppUserId.startsWith("$RCAnonymousID") || info.originalAppUserId !== userId) {
          await Purchases.logIn(userId);
        }
      } catch (loginErr) {
        console.warn("[premiumService] Non-blocking logIn sync warning:", loginErr);
      }

      // First, get the actual package from RevenueCat
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;

      if (!currentOffering) {
        throw new Error("No offerings found");
      }

      const pkgToPurchase = currentOffering.availablePackages.find(p => p.identifier === packageId);

      if (!pkgToPurchase) {
        throw new Error("Package not found");
      }

      let customerInfo: any = null;
      try {
        const result = await Purchases.purchasePackage(pkgToPurchase);
        customerInfo = result.customerInfo;
      } catch (purchaseErr: any) {
        // Handle OperationAlreadyInProgress: Check if the transaction succeeded or is already active
        const isAlreadyInProgress =
          purchaseErr.code === 8 ||
          purchaseErr.message?.includes("already in progress") ||
          purchaseErr.code === "OperationAlreadyInProgressError";

        if (isAlreadyInProgress) {
          console.warn("[premiumService] OperationAlreadyInProgress detected. Checking active customer info...");
          customerInfo = await Purchases.getCustomerInfo();
        } else if (purchaseErr.userCancelled) {
          return false;
        } else {
          throw purchaseErr;
        }
      }

      const activeEntitlements = customerInfo?.entitlements?.active || {};
      let activeEntitlement =
        activeEntitlements["pro"] || Object.values(activeEntitlements)[0];

      if (!activeEntitlement || !activeEntitlement.isActive) {
        const allEntitlements = customerInfo?.entitlements?.all || {};
        const unexpired = Object.values(allEntitlements).find((ent: any) =>
          ent?.expirationDate && new Date(ent.expirationDate).getTime() > Date.now()
        );
        if (unexpired) {
          activeEntitlement = unexpired;
        }
      }

      const isUnexpired = activeEntitlement?.expirationDate
        ? new Date(activeEntitlement.expirationDate).getTime() > Date.now()
        : Boolean(activeEntitlement?.isActive);

      const hasActiveSub = Boolean(
        (customerInfo?.activeSubscriptions && customerInfo.activeSubscriptions.length > 0) ||
        (customerInfo?.allPurchasedProductIdentifiers && customerInfo.allPurchasedProductIdentifiers.length > 0)
      );

      if ((activeEntitlement && isUnexpired) || hasActiveSub) {
        const expirationDate = activeEntitlement?.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        try {
          await premiumRepository.grantPremiumEntitlement(userId, expirationDate);
        } catch (repoErr) {
          console.warn("[premiumService] grantPremiumEntitlement non-blocking warning:", repoErr);
        }
        try {
          const { useSubscriptionStore } = require("../../store/user/subscriptionStore");
          useSubscriptionStore.getState().updateFromCustomerInfo(customerInfo);
        } catch (e) {
          console.warn("[premiumService] Failed to update subscriptionStore:", e);
        }
        try {
          const { useHistoryStore } = require("../../store/workout/historyStore");
          useHistoryStore.getState().invalidateCache();
          if (userId) {
            useHistoryStore.getState().loadInitialHistory(userId, true, true);
            useHistoryStore.getState().loadPersonalRecords(userId, true);
          }
        } catch (e) {
          console.warn("[premiumService] Failed to invalidate historyStore cache:", e);
        }
        return true;
      }

      return false;
    } catch (error: any) {
      if (!error.userCancelled) {
        throw new Error(error.message || "Failed to complete purchase.");
      }
      return false;
    } finally {
      isPurchaseInProgress = false;
    }
  },

  async restorePurchases(userId: string): Promise<boolean> {
    if (isRestoreInProgress) {
      console.warn("[premiumService] Restore already in progress. Ignoring duplicate call.");
      return false;
    }
    isRestoreInProgress = true;

    try {
      let customerInfo: any = null;
      try {
        customerInfo = await Purchases.restorePurchases();
      } catch (restoreErr: any) {
        const isAlreadyInProgress =
          restoreErr.code === 8 ||
          restoreErr.message?.includes("already in progress") ||
          restoreErr.code === "OperationAlreadyInProgressError";

        if (isAlreadyInProgress) {
          console.warn("[premiumService] Restore OperationAlreadyInProgress detected. Checking active customer info...");
          customerInfo = await Purchases.getCustomerInfo();
        } else {
          throw restoreErr;
        }
      }

      const activeEntitlements = customerInfo?.entitlements?.active || {};
      let activeEntitlement =
        activeEntitlements["pro"] || Object.values(activeEntitlements)[0];

      if (!activeEntitlement || !activeEntitlement.isActive) {
        const allEntitlements = customerInfo?.entitlements?.all || {};
        const unexpired = Object.values(allEntitlements).find((ent: any) =>
          ent?.expirationDate && new Date(ent.expirationDate).getTime() > Date.now()
        );
        if (unexpired) {
          activeEntitlement = unexpired;
        }
      }

      const isUnexpired = activeEntitlement?.expirationDate
        ? new Date(activeEntitlement.expirationDate).getTime() > Date.now()
        : Boolean(activeEntitlement?.isActive);

      const hasActiveSub = Boolean(
        (customerInfo?.activeSubscriptions && customerInfo.activeSubscriptions.length > 0) ||
        (customerInfo?.allPurchasedProductIdentifiers && customerInfo.allPurchasedProductIdentifiers.length > 0)
      );

      if ((activeEntitlement && isUnexpired) || hasActiveSub) {
        const expirationDate = activeEntitlement?.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        // Proactively grant entitlement in DB to avoid webhook race conditions for instant UI unlock
        try {
          await premiumRepository.grantPremiumEntitlement(userId, expirationDate);
        } catch (repoErr) {
          console.warn("[premiumService] grantPremiumEntitlement non-blocking warning on restore:", repoErr);
        }
        try {
          const { useSubscriptionStore } = require("../../store/user/subscriptionStore");
          useSubscriptionStore.getState().updateFromCustomerInfo(customerInfo);
        } catch (e) {
          console.warn("[premiumService] Failed to update subscriptionStore on restore:", e);
        }
        try {
          const { useHistoryStore } = require("../../store/workout/historyStore");
          useHistoryStore.getState().invalidateCache();
          if (userId) {
            useHistoryStore.getState().loadInitialHistory(userId, true, true);
            useHistoryStore.getState().loadPersonalRecords(userId, true);
          }
        } catch (e) {
          console.warn("[premiumService] Failed to invalidate historyStore cache on restore:", e);
        }
        return true;
      }

      return false;
    } catch (error: any) {
      throw new Error(error.message || "Failed to restore purchases.");
    } finally {
      isRestoreInProgress = false;
    }
  },

  async syncEntitlements(userId: string): Promise<boolean> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const activeEntitlements = customerInfo?.entitlements?.active || {};
      let activeEntitlement =
        activeEntitlements["pro"] || Object.values(activeEntitlements)[0];

      if (!activeEntitlement || !activeEntitlement.isActive) {
        const allEntitlements = customerInfo?.entitlements?.all || {};
        const unexpired = Object.values(allEntitlements).find((ent: any) =>
          ent?.expirationDate && new Date(ent.expirationDate).getTime() > Date.now()
        );
        if (unexpired) {
          activeEntitlement = unexpired;
        }
      }

      const isUnexpired = activeEntitlement?.expirationDate
        ? new Date(activeEntitlement.expirationDate).getTime() > Date.now()
        : Boolean(activeEntitlement?.isActive);

      const isPremium = Boolean(activeEntitlement && isUnexpired);

      if (isPremium) {
        await premiumRepository.grantPremiumEntitlement(userId, activeEntitlement.expirationDate);
      } else {
        await premiumRepository.revokePremiumEntitlement(userId);
      }

      try {
        const { useSubscriptionStore } = require("../../store/user/subscriptionStore");
        useSubscriptionStore.getState().updateFromCustomerInfo(customerInfo);
      } catch (e) {
        console.warn("[premiumService] Failed to sync subscriptionStore:", e);
      }

      return isPremium;
    } catch (e) {
      console.error("Failed to sync entitlements", e);
      return false;
    }
  },
};
