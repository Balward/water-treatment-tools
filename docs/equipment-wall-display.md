# Equipment Status Board Wall Display

Use `/live-operations-dashboard/?mode=tv` for unattended viewing. The regular URL retains the equipment and comment editors. The header QR opens that regular editor on a phone.

## Readability

The wall layout keeps all 27 equipment tiles stationary in four full-width rows, with High Zone and Booster Pumps sharing one eight-card row. General Comments is below the equipment. The desktop wall header is 82px high; the regular editor retains the standard Operations header. At 1920 by 1080, wall cards are approximately 149px tall with the header shown and 165px with it hidden.

Equipment typography is measured against the actual card dimensions rather than fixed maximum font sizes. A shared name size uses the narrowest/shortest card and is fitted to keep every name on one line using the full card width. Compact displays can reduce names to 14px to keep the full title visible. Very narrow phones (360px and below) use one card per row to preserve readable single-line names. Status symbols appear as large, 12% opacity watermarks cropped by the bottom-right card edges. They scale with each card and sit behind the text, allowing notes to use the full width. Notes and status symbols grow with the names, and note text can reduce modestly (up to 20%, with a 16px desktop floor) when that preserves a complete short operating note. Larger cards have no 25px/32px name ceiling or 15px/20px note ceiling. Short screens prioritize names; the existing full-note dialog and phone editor retain complete notes. Notes use every complete line that fits below the equipment name, without a fixed line-count limit, and recalculate when cards resize. Overflow previews fit to the final available character and end with a compact ellipsis-and-arrow cue; selecting the card still opens the complete note. The solid status colors and text have measured contrast of at least 4.5:1 in both themes; symbols continue to identify each status without relying on color alone.

The layout is verified from 900×600 through 3840×2160, including 2560×1440. The 4K fixture renders equipment names at 78px, its first operating note at 49px, and status watermarks at approximately 343px. On tall high-resolution displays, section headings, legend counts, and comments also grow, with a comments panel matching the equipment card height. Typography recalculates after live data, font loading, viewport changes, and equipment-area resizing. This is a browser-layout check, not confirmation of readability at a particular physical viewing distance. A 1080p display is the primary design target; check it on the installed monitor before choosing its final zoom and brightness.

## Header Visibility

The footer provides **Hide Header** / **Show Header** on desktops, in both viewing and editing modes. A dedicated right-hand grid column keeps this control aligned even when status text wraps. The choice is remembered per browser. The restore control stays visible outside the header. The same editor QR moves to a reserved bottom-right corner beside the comments and footer when the header is hidden, then returns to the header when shown. The QR and its label are hidden below 900px, with the header reclaiming their space. The QR image scales as a square to fill the panel height above its label, and the panel width follows the image size. This reserves comment/footer width only and preserves the equipment area. Phones always show the normal header; returning to desktop reapplies the saved preference. Optional `header=hidden` or `header=shown` URL parameters override the stored choice, and toggling updates an existing URL override.

When the header is hidden, a compact footer indicator reports connection checks and visibly warns about connection loss. Equipment, comments, and the legend continue to fill the available space. The header preference does not change shared headers in other apps.

## General Comments

Comments appear together as a stationary list with full text and a note count. Desktop notes divide the available width into equal columns based on the current comment count: one uses the full width, two split it in half, and so on. Adding or deleting a comment recalculates the columns. Phones retain stacked comments for readability. Comments occupy a bottom panel whose total height matches one equipment card. It recalculates as the viewport or header visibility changes. Its slim, contrasting header matches the equipment section headings in height and color, with the note count and Add Comment action kept in that header. Messages appear above a smaller author/date line; the full timestamp remains available in the time element and its tooltip. Matched outline edit/delete icons sit alongside each message (28px desktop controls, 44px phone targets) and retain their accessible labels and delete confirmation. Automatic rotation, page splitting, and paging controls have been removed. The normal sample notes fit together across the bottom panel without scrolling on taller wall displays; short desktop screens retain manual comment scrolling. Unusually long lists retain readable text and allow manual overflow scrolling, with a visible indicator when more comments remain below; the app does not hide notes or shrink their text to force an unlimited amount of content onto one screen.

Use **Pin On Wall Display** in the existing Add/Edit Comment form to prioritize a notice. Pins are stored by the API and shared across devices. Older records default to unpinned, and older clients that omit the pin field preserve the current choice. Pinned notices appear first in both viewing and editing modes.

Phone layouts let the full comment list expand with the page. Editing, pinning, and deleting retain their existing controls. Equipment tiles remain stationary, and the recent-change border still respects reduced-motion preferences.

## Changes And Connection Health

The moving tile border identifies equipment edited within two minutes. A 6px black track with a hard-edged white sweep provides strong contrast against every status color in either theme, without changing card size. It completes one circuit every four seconds and remains stationary with reduced motion enabled. The footer prioritizes the latest update with larger, bold text and omits the explanatory availability/legend captions. It always describes the latest recorded equipment change, including whether its status or notes changed, who made it, and its relative age in minutes, hours, or days. The age refreshes every ten seconds; the notice does not expire. An exact date/time is available in its tooltip. Missing author data is labeled Unknown operator. Comment edits do not create equipment-change notices.

**Equipment updated** describes persisted equipment edits. **Last connection check** describes communication with the board API, including SSE heartbeats. The board reports operator-entered equipment availability; it does not represent live running-state telemetry.

EventSource retains its native retry behavior. A watchdog replaces a stream after 65 seconds without activity, checked every ten seconds, with at least 15 seconds between explicit reconnect attempts. Going online, resuming a stale hidden page, and returning through the browser's page cache also reconnect. A restored snapshot repopulates the board even if its first API request failed. Connection loss leaves existing statuses visible with a warning until communication returns.

## Change Log Corrections

In the regular editor, select equipment and expand **Change Log**. On desktop it opens automatically. The equipment drawer grows to roughly half the screen on typical desktops (capped at 1,280px on large displays). At widths of 1,100px and above, status/notes occupy the left column and history has a separate full-height scrolling column with a sticky heading. The old 190px inner log limit is removed on desktop, with larger history text. Phones retain a single-column editor, and the comment drawer is unchanged.

Each entry leads with the change text, followed by a small muted audit line: timestamp and operator name together. Each entry has **Edit Entry** and **Delete Entry** controls. Edit Entry allows corrections to the operator name and recorded before/after text while preserving its original timestamp. Deletion requires confirmation. These operations affect history only; correct an accidentally selected equipment status separately using its normal controls. The latest-update footer follows the newest remaining history entry and uses that entry's recorded status, operator, and time.

Entries have stable IDs, including older saved history. The API compares the entry being edited/deleted with its saved version and rejects stale changes rather than overwriting another operator's correction. Log changes persist to disk and are broadcast to other devices.

## Validation

Run `node scripts/check-live-ops.cjs` or `npm run check:ui -- equipment headers`. Checks use temporary API data and cover readable geometry, the full-width equipment layout, persistent header visibility controls, connection warnings with the header hidden, complete static comment text, persisted pin/unpin actions, both themes and contrast, equipment edits and audit history, stream interruption/stall/initial-load recovery, reduced motion, and phone/editor layouts. They do not modify production data.

Mobile drawers use one bottom safe-area allowance rather than stacking large panel and footer padding. Footer buttons retain 44px touch targets; the compact audit line leaves more space for scrollable details. Notes inputs use 16px text to avoid focus zoom on phones.

General Comments message text scales continuously with desktop viewport width and height, with an 18px minimum and no fixed TV maximum. Typical sizes are about 24px at 1920x1080 and 48px at 3840x2160, replacing the previous 34px cap. Long comments remain available through scrolling rather than shrinking to fit. Mobile text and the secondary audit details retain their existing sizing.

Out-of-service cards show elapsed time from a separate `statusSince` timestamp, refreshed with the connection/status indicators. Note-only edits and history corrections do not reset it. On older records the server can recover the start from the most recent matching status transition; where that time is unknown, the duration line is omitted rather than guessing from a note timestamp. New status changes record their own start time.

Equipment and General Comment saves select an active operator from the [shared user directory](operations-users.md), managed through Apps > User Management. Existing audit names remain as recorded.

Release asset version: `20261028-suiteusers1`. Local changes require the normal suite deployment to reach the wall monitor.
