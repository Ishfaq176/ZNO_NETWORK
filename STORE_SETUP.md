# Zeno Convert Pro website store

The existing GitHub Pages product page now supports Google Gmail sign-in,
Windows lifetime orders at **PKR 9,999**, HBL bank transfer reference submission,
owner bank-credit review, account access/download, family controls, fresh-Google
account deletion and Windows computer-code approval. Android lifetime marketing
price is **PKR 9,899**, purchased separately through Google Play.

Receiving account: **HBL / MUHAMMAD ISHFAQ**, IBAN
`PK56HABB0008477902771003`, account `08477902771003`.

`store-config.js` contains public Firebase Auth configuration for the existing
`zeno-convert-pro` project. It contains no service-account key or bank credentials.
Owner privileges are determined by protected Cloud Functions, never by an email
comparison in the page.

GitHub Pages publication succeeded on 11 October 2026 for website implementation
commit `dde2571c37a87025c4abda3ebf7ff6e18526300a` (run `38141078744`). Firebase
already has Google as its only enabled provider; canonical `zenonetwork.xyz`
was added and verified as an authorized domain. The separate `www` origin was
not added and is not needed for the canonical website.

Deploy the matching app repository's commerce functions, Firestore rules and
indexes first. That live deployment is still pending; source/static publication
does not activate checkout or license delivery.
Sign in as **mr.ishfaq302@gmail.com** to bind the owner UID. Functions must also
have the actual runtime service account's custom-token signing permission.
See the app repository's current **CONSOLE_SETUP.md** for all commands.

Sales stay closed until the owner supplies a tested, publicly downloadable HTTPS
Windows installer URL in the website's Owner controls and enables sales. Keep
the EXE with its DLLs and data folder; distribute the complete ZIP/installer.
A private GitHub release link does not work for ordinary customers.

Before approving an order, verify the actual HBL credit of exactly 9,999 in your
bank account. Enter the unique real bank-credit reference; the server prevents
reuse of the same credit. A customer's reference alone does not activate access.
Never enter HBL login credentials, PIN or OTP in the website code.

Verification performed: JavaScript syntax, HTML/JS target and anchor checks,
unique IDs, fixed prices and safe dynamic text rendering. Visual browser QA and
live Firebase/login/order/download tests remain pending. The website source
alone does not prove a working live backend or a tested installer.
