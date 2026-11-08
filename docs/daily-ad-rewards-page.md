# Daily ad rewards page

The Home ad card now opens /ad-rewards. The dedicated Arabic page contains six numbered rows, a 0–6 progress display, locked stages, coin amounts 100/250/500/1000/1500/2000 and the existing five-tab dock. It replaces the prior single-ad 50-coin Home design proposal.

Browser development builds link from Home to /ad-rewards?preview=ads for a clearly labelled, interactive design showcase. Watching is simulated only after a confirmation dialog. Steps unlock sequentially, stop at six, and can be reset. Preview progress exists only in component memory and never touches wallet, storage, an ad SDK or a reward endpoint.

Outside that development-only browser mode, all viewing is disabled with a service-unavailable explanation. No actual daily count, reset or payout is enforced locally. Backend/Supabase activation remains explicitly declined. The existing secure rewarded-ad adapter and loss-recovery preparation remain separate and pending backend integration.

The user confirmed independent payouts for each ad: 100 + 250 + 500 + 1000 + 1500 + 2000 = 5350 coins per day. The display configuration declares per-ad mode and derives the total; actual credit and daily enforcement remain server responsibilities and are not activated.

Validation: TypeScript and focused ESLint passed. Browser verification exercised all six stages, confirmed no seventh watch button, checked six completed stages and unchanged 2000 wallet, reset the showcase, verified real viewing is disabled without preview mode, and followed the Home link to the new page. Actual native ads and daily server progression were not tested or enabled. No production changes, build or push.
