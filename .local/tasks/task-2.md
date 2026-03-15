---
title: Link app to organization EAS account for builds
---
# Link EAS to Organization Account

## What & Why
Add `owner` field to app.json pointing to `aissam09s-organization` so EAS builds use the organization account (which has 15 builds available) instead of the personal account (which is depleted at 15/15 this month).

## Done looks like
- `app.json` has `"owner": "aissam09s-organization"` added
- Run `eas init` in shell to create/link a new project under the org and update the projectId
- `eas build --platform android --profile preview` starts successfully using the organization quota

## Out of scope
- Changing any app code or functionality
- Modifying eas.json build profiles

## Tasks
1. **Add owner to app.json** — Add `"owner": "aissam09s-organization"` inside the `expo` object in app.json.
2. **Re-initialize EAS project** — Run `eas init` in the shell to create a new EAS project under the organization and update the projectId in app.json automatically.

## Relevant files
- `app.json`