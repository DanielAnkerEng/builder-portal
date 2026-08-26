# Controlled legacy website import

The import is deliberately staged and never reads or changes production browser storage remotely.

1. Serve `tools/legacy-import/export.html` on the exact legacy portal origin so the browser can access the old Wreach storage keys.
2. The exporter reads `sn_accounts` and `sn_builder_state__<account-id>`, excludes passwords and session data, computes a SHA-256 fingerprint, downloads a manifest, and leaves every original key unchanged.
3. An AAL2 platform administrator submits each manifest item to `import-legacy-site` with action `stage`. The server validates the full content schema and stores it as `needs_mapping`; no website, draft, or publication is changed.
4. Review the staged report alongside production companies. Never infer a mapping from duplicate names. If the legacy account contains a UUID company reference, a different target is rejected.
5. An AAL2 platform administrator confirms one exact company, site name, and unique public slug using action `confirm_mapping` and `mappingConfirmed: true`. The operation creates a new website and revision-1 private draft only.
6. Compare the imported draft with the original browser data and fingerprint. Keep the export and original local storage until acceptance is recorded.
7. Create the first live snapshot only with the ordinary Publish workflow. This separately requires AAL2, publisher authorization, the actor's personal security key, and the exact draft revision.

Failures leave the staged row and original browser state available for investigation. A fingerprint cannot be staged twice, and an approved mapping cannot be remapped.
