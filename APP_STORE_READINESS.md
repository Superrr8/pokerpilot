# PokerElevate App Store Readiness Record

## Purpose

This document records repository-derived inputs for a later App Store Connect submission. It is not an age-rating answer, legal opinion, trademark clearance, privacy disclosure submission, or authorization to begin native packaging.

## Primary product positioning

PokerElevate is an educational Texas Hold’em decision-training product for study, practice, simulation, and retrospective hand review. It does not accept wagers, hold funds, award cash or redeemable prizes, or offer or facilitate real-money gambling.

Training includes deterministic lessons, decision exercises, Hand Lab review, and simulated 6-max/9-max Live sessions. Recommendations are educational model outputs with disclosed assumptions and confidence, not professional advice, guaranteed GTO proof, or guaranteed financial performance.

## Privacy model

- No user account or server-side PokerElevate profile exists in the current web product.
- Profile, progress, assessment, saved hands, Daily Hand history, consent, locale, theme, and audio preferences are stored locally on the user’s device.
- The application source contains no advertising, analytics, tracking, telemetry, or application data-upload service.
- The GitHub Pages hosting provider may process ordinary web-request metadata under its own policy.
- Users can delete every PokerElevate-owned current and legacy local-storage key through **Delete All Local Data**, returning the app to clean first-launch behavior without deleting unrelated browser storage.
- Terms and Privacy acceptance store independent version, timestamp, locale, and document identity fields. A version change requires non-destructive re-consent.

The App Store Connect privacy questionnaire must be answered from the final native build and every embedded third-party SDK, if any. The current repository supports a “no app data collection” position, but that answer must be re-audited after native packaging.

## Simulated-gambling classification

PokerElevate contains recurring poker simulation, virtual chips, stakes, pots, hand outcomes, and poker strategy education. These have no cash value and cannot be purchased, withdrawn, or redeemed. The product does not provide real-money gaming.

App Store Connect’s age-rating questionnaire includes separate declarations for gambling and simulated gambling. The operator must answer the simulated-gambling frequency truthfully after native packaging and content scope are frozen. The final Apple age rating must not be guessed or selected in this repository; App Store Connect must calculate it from the completed questionnaire and regional requirements.

## Public URL inventory

Current canonical document versions: Terms `1.0`, Privacy `1.0`, Support `1.0`, Responsible Play `1.0`. All pages render the same canonical EN/RU copy consumed by the in-app legal controls.

| Destination | English | Russian | Submission use |
| --- | --- | --- | --- |
| Terms of Use | https://superrr8.github.io/pokerpilot/legal/?document=terms&lang=en | https://superrr8.github.io/pokerpilot/legal/?document=terms&lang=ru | In-app and release reference |
| Privacy Policy | https://superrr8.github.io/pokerpilot/legal/?document=privacy&lang=en | https://superrr8.github.io/pokerpilot/legal/?document=privacy&lang=ru | App Store Privacy Policy URL |
| Support / Contact | https://superrr8.github.io/pokerpilot/legal/?document=support&lang=en | https://superrr8.github.io/pokerpilot/legal/?document=support&lang=ru | Architecture only until contact dependency is resolved |
| Educational Use / Responsible Play | https://superrr8.github.io/pokerpilot/legal/?document=responsible-play&lang=en | https://superrr8.github.io/pokerpilot/legal/?document=responsible-play&lang=ru | Review notes and in-app reference |

The Support page is publicly reachable, but it does not yet contain a verified support contact. Apple requires an easy and accurate way to contact the developer. Operator-controlled contact details must be supplied before the URL is used for submission.

## Claims and real-time-assistance boundary

- Poker IQ, Decision Quality, skill scores, levels, and ranks are proprietary PokerElevate educational metrics.
- They are not standardized IQ tests, professional certifications, independently validated skill ratings, guaranteed GTO proof, or predictions of winnings or financial performance.
- Accuracy labels describe performance on the app’s own exercises or recorded decisions, not a promise of real-world poker results.
- EV, equity, outs, and pot odds are mathematical/model outputs for supplied or simulated hand inputs; recommendations remain sensitive to assumptions and ranges.
- PokerElevate is intended for study, practice, simulation, and retrospective review. It is not intended for prohibited real-time assistance during real-money play where law, venue rules, or platform rules forbid that use.

App Store title, subtitle, description, keywords, screenshots, previews, and review notes must preserve these boundaries and avoid unverifiable superiority, profitability, professional-skill, or guaranteed-performance claims.

## Content-rights status

Repository inspection found no runtime third-party library, remote font, image pack, sampled audio, casino/operator brand asset, analytics SDK, or advertising SDK. Audio is generated by a deterministic local recipe. The current production UI uses code-native CSS, text, and Unicode glyphs.

The repository alone cannot prove ownership. Before submission, the operator must complete the attestations and external evidence listed in `RELEASE_PROVENANCE.md`, including contributor rights, educational copy/ranges/scenarios, audio-recipe authorship, branding, screenshots, and trademark clearance.

## App Store Connect preparation checklist

- Confirm the final developer/operator legal identity and any required trader status information.
- Add verified, monitored support contact information to the public Support page.
- Obtain legal approval of the final Terms and Privacy Policy and confirm applicable jurisdiction/consumer requirements.
- Enter localized Privacy Policy URLs and complete the privacy questionnaire from the final native build.
- Complete the age-rating questionnaire truthfully, including the actual frequency of simulated gambling; accept the calculated regional ratings rather than guessing one.
- Prepare accurate EN/RU metadata, review notes, and release-build screenshots with fictional data.
- Explain in review notes that all chips and dollar-denominated examples are simulations with no cash value and that the app offers no real-money gambling.
- Document the training/retrospective-use boundary and confirm distribution-region requirements for poker training tools.
- Complete PokerElevate trademark/name clearance.
- Complete provenance and contributor-rights sign-off; add any license notices introduced during native packaging.

## Outstanding external decisions

1. Verified support contact: operator-controlled email, support form, or equivalent contact route; do not fabricate an address, phone number, legal entity, or personal identity.
2. Final legal approval and operator/jurisdiction details for Terms and Privacy.
3. Apple Developer account holder, seller/developer name, trader status, copyright holder, and App Review contact.
4. App Store privacy disclosure answers after inspecting the native container and all SDKs.
5. App Store Connect age-rating answers and resulting regional ratings after scope freeze.
6. Legal/regulatory review of poker education and real-time-assistance restrictions in intended distribution regions.
7. PokerElevate trademark clearance and final brand ownership documentation.
8. Contributor assignments, content provenance attestations, and any licenses introduced by native assets or dependencies.

## Official Apple references used for readiness planning

- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Manage App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- App Privacy reference: https://developer.apple.com/help/app-store-connect/reference/app-privacy/
- Age ratings values and definitions: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions
- Platform version information and Support URL requirements: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
