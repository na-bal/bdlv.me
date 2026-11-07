# Windows update checks

Windows release 0.1.6 adds the JSON feed and counter described here. Before this
publication the Windows URL returned HTTP404. Deployment and native acceptance
are recorded in the Windows application repository's release report; committing
these files alone is not deployment verification.

`/products/musli/windows/latest.json` is internally rewritten to
`updates/latest.php`. It returns the existing JSON bytes and updater signature
unchanged, with `Cache-Control: no-store`. GET records a feed check; HEAD does not.
This does **not** count completed installer downloads or installations.

The Mac XML and Windows JSON entry points use `updates/check-log.php`, extracted
from the existing Mac counter. They share private `../stats/checks-YYYY-MM.jsonl`,
existing daily/address caps, sanitization and best-effort writes. Mac row shape
is unchanged. Windows adds `platform=windows` from its server route; query input
cannot spoof that field. No raw IP is logged. Existing Mac logs are retained.

The Windows client currently sends id/name/first/v/os/chip/model/ram/tz/lang/rec.
It does not yet send Mac's login/tried/fail fields or a separate build number.
This server change does not invent unavailable values for those fields.

Both feeds remain available if the optional logging helper is temporarily absent
or logging storage cannot be written. Invalid/array query values cannot corrupt
the response. The static JSON must still exist; otherwise Windows correctly404s.

Validation:

```sh
npm run build
npx playwright test --config playwright.update-feeds.config.ts
```

29 tests passed: Mac counter regression, Windows responses/logging/privacy/caps,
optional-helper failure, and static Apache rule/build inclusion. PHP's built-in
server executes the handlers; Apache rewriting is checked as configuration text.
Live Apache behavior must be verified after an authorized deployment.

For deployment, retain the previous Mac entry point for rollback, copy the shared
helper/Windows handler and release files, then enable the rewrite. Confirm both
feeds and response hashes/headers externally; inspect only aggregate log counts
and platform keys. Avoid adding an owner's install identity just to test access.
Rollback restores the previous entry point/rule; never remove private stats logs.
