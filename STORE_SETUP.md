# Zeno Convert Pro shared lifetime store

New lifetime website orders cost **PKR 9,899**. One verified purchase through
Google Play or this website unlocks Android and Windows for the same verified
Gmail/Firebase identity. Existing PKR 9,999 orders keep their original amount.
The bank recipient and public Firebase configuration are unchanged.

Deploy the shared backend from the Windows repository's `services/` directory
using `scripts/DEPLOY_WINDOWS_SERVICES.ps1 -Deploy`. That source preserves the
existing Android Play product and secure account checks. The Android client
observes the same server-owned entitlements; no new Android AAB is required just
for this shared access change. Do not redeploy older split-purchase modules.

The owner has deployed the shared services successfully. Real Google browser
approval and customer purchase/activation still need account tests. Browser
approval needs the deployed runtime's custom-token signer permission.

Owner status requires the server-bound Google UID plus verified owner email.
Owner and Family Premium apply to both platforms. Revocation preserves a separate
paid purchase. Verify Google Play refunds with real-time developer notifications;
see the Windows repository's `services/README.md` for setup and offline limits.

Keep sales closed until the complete Windows ZIP/installer is tested and a real
public HTTPS download is configured in Owner controls. Do not link to a private
source-repository release. The same complete Windows ZIP includes **5 successful
free exports total** on the Windows user profile, then requires verified
Premium for further exports. Trial exports need no Google sign-in; failed or
canceled operations do not count. Restarting or changing Gmail does not reset
the local protected count.

Deploy the updated `getStoreConfiguration` from the Windows `services/` source.
When the tested download/store is enabled, its public `trialDownloadUrl` enables
the website's free Windows download button without account sign-in. It stays
disabled while the download/store is not ready. Downloading the app never
creates a Premium entitlement. Premium download and activation keep their
existing Google/paid/family/owner checks. Do not publish the earlier 1.2.4+7 ZIP
as the free trial: package version 1.2.5+8 after running the native checks.

Customers must create an order before a bank transfer. Approve only after
checking the actual bank credit and the exact amount of that order. Customer
references never grant access on their own; bank-credit reuse is rejected.
Never store banking logins, PINs, OTPs, private Firebase keys or signing keys in
this website. A Google Play purchase already verified for this Gmail must not
be sold again as a second Windows purchase.

Before opening sales, test real Google sign-in/device approval, Android Restore
Purchases -> Windows activation, website order approval -> Android activation,
family grant/revoke, a refunded purchase, wrong-user denial and the complete
customer bundle on another Windows PC.
