# Project checkpoint

Last updated: 2026-11-02

## Product
- Hebrew RTL roster and day-to-day unit coordination app, built with Expo, React Native, and TypeScript.
- Work screen by screen; preserve existing content and behavior unless the user asks to change it.

## Approved visual direction
- Start with the home screen only, then reuse the visual system on other screens after the user approves it.
- Pure black page background (`#000000`), charcoal cards, restrained purple accents, sharp line icons, Hebrew RTL.
- Home hero uses the mountain image and the motto `איתך לעד` in David.
- Icon accent sampled to match the reference: `#B874E8`; feature glyphs are clean outline SVGs inside subtly purple-tinted black cards.

## Current progress
- Fox button visibility: decorative purple SVG is explicitly at z-index 0; fox now sits inside a positioned foreground View at z-index 1. Bottom-bar tabs and central slot have explicit foreground stacking. Physical/browser visual confirmation remains pending.
- Readiness fighter columns 1–4 now have editable headings (tap a header). Titles are stored separately from assignment indices, so editing a heading preserves assigned people. Four labels are saved/backed up, validated, and optional for legacy backup compatibility.
- Central purple navigation button now displays an original minimal line fox head. Guards replaced Tasks in the bottom bar; Tasks moved into the fox menu.
- Fox menu now has matching line icons and entry screens for Medicine, Welfare (ת״ש), Fitness, Education, and Readiness. These five are explicitly planning-only placeholders, as requested: no medical/welfare aggregation, exercise tracking, education scheduling or readiness business logic has been implemented. Menu content scrolls on short mobile viewports; existing add-person/task and backup actions remain.
- TypeScript excludes generated dist output to prevent typecheck/export races over hashed web bundles.
- Guards screen now also has a כפכ״פ / readiness table with its own editable time rows, four fighter slots and one commander per row. All selections refer to People. Only marked commanders are eligible for commander slots, non-commanders for fighter slots, and a person cannot occupy two cells in one readiness row. Deletion and role changes clear invalid readiness assignments. Readiness is included in local saving and backups; old backups without the new fields remain compatible.
- People now have one exclusive group (lone soldiers, married, others), plus an independent commander flag and commander filter. Default/legacy people appear in Others. New or edited names are normalized and duplicate full names are blocked without deleting legacy records. Bulk-add people UI/state was removed as requested; multi-select deletion remains.
- Readiness tests passed for role eligibility, unique cells, assignment/clearing, deletion and role changes, grouping without duplicate cards, backup roundtrip and legacy compatibility, and rejection of invalid readiness backups. Actual iPhone layout confirmation remains pending.
- Fixed RN Web invalid direction style warning: bottom-navigation direction is now scoped browser CSS rather than a StyleSheet property. Full stylesheet runtime validation against installed react-native-web and TypeScript checks passed.
- Bottom navigation now follows the supplied reference: full-width charcoal gradient panel with rounded upper corners, four line-icon tabs around a central purple gradient +. Purple colors sampled from the reference: active #9240E2, gradient #8036C1 to #56207D, muted #BDB4CA. Home is on the left as in the reference; people on the right. + menu includes guards, add person/task and backups, retaining access to every screen. Successful-save footer moved into + menu; errors remain visible.
- iPhone web layout uses dynamic viewport height and one bottom safe-area inset (owned by the bar), preventing doubled bottom spacing. Local Edge screenshot check failed due unavailable GPU in the restricted environment; actual iPhone appearance still requires confirmation.
- Safari/web auto-save now uses versioned localStorage for people (including personal status fields/photos), roster, guards/posts/slots/assignments, tasks and editable absence/base options. Initial loading is synchronous and does not overwrite invalid stored data. Save failures are visible.
- A global saving/backup button exports JSON files and restores validated backups only after explicit replacement confirmation. Restoring writes to storage before replacing screen state. Changing tunnel origin/browser/device requires export/import; no cloud sync. Native installed-app persistence remains unimplemented and is explicitly marked unavailable in UI.
- Storage checks passed for reopen roundtrip, all data sections, deleted/empty collections, malformed/unsupported/orphaned backups, blocked access and quota failures. Browser UI automation could not connect to its isolated Edge session; actual Safari persistence and backup-file interaction still require device confirmation.
- People: selection mode in both grid sizes, select all visible, clear selection, and confirmed bulk deletion. Deletion also removes roster entries, guard assignments, and stale roster selections for deleted people.
- People are added individually; the former multiline bulk-add feature was removed at the user's request.
- Personal files: editable medical, welfare (ת״ש), fitness, discipline, and values notes; empty fields display טרם מולא. Personal file viewing/editing scrolls on mobile. Existing general status and tags are preserved.
- User prefers simple Hebrew explanations with concrete steps; English technical messages were from a software engineer friend assisting through AnyDesk.
- User started Expo web tunnel outside Codex on port 8090. Metro served the updated people screen bundle successfully. TypeScript and a bulk-deletion relationship check passed. iPhone visual confirmation remains pending.
- SVG icons now use aria-hidden on web, avoiding the invalid accessible boolean DOM attribute warning; native accessible behavior is preserved.
- Home screen has the mountain hero and black fade into the page background.
- All app text and text inputs load David Libre regular, medium, and bold locally; this is the open version of David Hadash.
- Home feature icons use outlined SVGs, with subtly purple-tinted black cards and the matching lavender accent.
- Home title greets Eyal dynamically by local time: morning, afternoon, or evening.
- `pnpm run typecheck` and `pnpm run build:web` passed after the latest changes.
- Static preview: `http://localhost:8082/iphone-preview.html`. Live Metro web tunnel is on port 8090. Both servers are session-based and must be restarted if stopped.

## Keep in view before daily iPhone use
- User deferred permanent persistence/hosting until the end and suggested Railway as a likely candidate. No Railway account, database, deployment or migration has been set up or authorized yet; local save/backup stays available meanwhile.
- Verify Safari close/reopen and backup download/restore on the actual iPhone. Use a stable address before daily use; temporary tunnel addresses have separate localStorage. Native device persistence and account/cloud sync remain pending.
- Confirm the locally loaded David Libre font on the physical iPhone.
- Review the home screen with the user before applying its design to the remaining screens.
- Assistant provider is undecided; define which edits it may make and how the user approves them.
- External quick links (Maps, Waze, Google Calendar, Moovit) are desired; decide the exact actions and permissions later.

## Roster feature direction to verify
- List people by first and last name with their filled-in role/פק״ל.
- Support selecting multiple people and bulk-setting present/absent.
- Absence reasons and present bases should be editable by the user.
