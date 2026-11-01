# react-native BACKLOG

Decidable data-only rules ship in this pack. Everything below needs lifecycle, flow, config, or native-side knowledge the closed syntax vocabulary cannot prove. Candidates for a future version, in rough value order.

## Needs lifecycle or effect analysis

- **Permission-request flow.** Using camera/location/notification APIs without a preceding `request()` check needs call-order proof across effects and handlers. Current syntax sees calls, not order.
- **`AppState` listener without cleanup.** Proving a missing `remove()` needs effect-return analysis, not just subscription shapes.
- **`setState` after unmount.** Needs mount-lifecycle tracking across async continuations.
- **`BackHandler` listener without removal.** Same cleanup proof as `AppState`; RN-PERM-001 only covers the `exitApp` kill.

## Needs value or provenance flow

- **Secret values (not names) in AsyncStorage.** RN-STORE-001 matches secret-shaped names in write arguments. A token arriving via a neutral alias (`store.save(k, v)`, wrappers, re-exports) is uncaught by construction.
- **Secret values (not names) in navigation params.** RN-OTA-001 matches secret-shaped words in `navigate` arguments. Neutral bundles and values fetched upstream are uncaught.
- **`route.params.token` reads.** Reading a secret param is a second sink in a different rule shape; currently only the `navigate` write side is covered.
- **String-literal `EXPO_PUBLIC_*` keys.** RN-SECRET-001 matches identifier/property names. `process.env["EXPO_PUBLIC_X_SECRET"]` string keys and computed env access are uncaught.
- **Arithmetic `+` inside navigate params.** RN-NAV-001 flags any `+` in `navigate` arguments, so `navigate("Order", { n: a + 1 })` over-matches while a route built upstream and passed as a variable under-matches.

## Needs config or native-side knowledge

- **Deep-link prefix allowlist.** Which schemes are legitimate lives in `app.json`/entitlements, not in syntax. RN-LOG-001 only forbids the `exp://` dev channel.
- **OTA channel config.** Update-channel pinning (`expo-updates` runtime version, channel names) lives in build config the TS engine does not parse.
- **Hermes bytecodeFlags/compat.** Hermes support (Proxy, `Intl`, generators) is a build-target property, not a syntax shape.
- **Native-module threading.** `@hide`/`@WorkerThread` annotations and bridge-call discipline live in Java/ObjC the TS pack cannot see.
- **Android cleartext config.** `usesCleartextTraffic` and `NSAppTransportSecurity` exceptions live in XML/plist outside the TS grammars.
- **FlatList tuning (`windowSize`, `getItemLayout`, `removeClippedSubviews`).** Performance tuning values are judgment calls with no decidable violation shape.

## Deliberate over-approximations (deny by default, documented)

- RN-PERM-001 flags any bare `exitApp()` call, including a same-named helper on another receiver chain. Rename or scope the helper if it does not kill the process.
- RN-NAV-001 flags any `+` or `${` in `navigate` arguments, including arithmetic inside a params object.
