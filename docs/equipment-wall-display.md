# Equipment Status Board Wall Display

Use `/live-operations-dashboard/?mode=tv` for unattended viewing. The regular URL retains the equipment and comment editors. The header QR opens that regular editor on a phone.

## Readability

The wall layout keeps all 27 equipment tiles stationary in four full-width rows, with High Zone and Booster Pumps sharing one eight-card row. General Comments is below the equipment. The desktop wall header is 82px high; the regular editor retains the standard Operations header. At 1920 by 1080, wall cards are approximately 159px tall with the header shown and 179px with it hidden.

Equipment names range from 20px to 32px, constrained by both screen width and height. Notes use 16px to 20px text, with stronger weight for equipment exceptions. Short screens prioritize names; the existing full-note dialog and phone editor retain complete notes. Larger screens show additional note lines. The solid status colors and text have measured contrast of at least 4.5:1 in both themes; symbols continue to identify each status without relying on color alone.

The layout is verified from 900×600 through 1920×1440. This is a browser-layout check, not confirmation of readability at a particular physical viewing distance. A 1080p display is the primary design target; check it on the installed monitor before choosing its final zoom and brightness.

## Header Visibility

The footer provides **Hide Header** / **Show Header** on desktops, in both viewing and editing modes. A dedicated right-hand grid column keeps this control aligned even when status text wraps. The choice is remembered per browser. The restore control stays visible outside the header. The same 68px editor QR moves to a reserved bottom-right corner beside the comments and footer when the header is hidden, then returns to the header when shown or on phones. This reserves comment/footer width only and preserves the equipment area. Phones always show the normal header; returning to desktop reapplies the saved preference. Optional `header=hidden` or `header=shown` URL parameters override the stored choice, and toggling updates an existing URL override.

When the header is hidden, a compact footer indicator reports connection checks and visibly warns about connection loss. Equipment, comments, and the legend continue to fill the available space. The header preference does not change shared headers in other apps.

## General Comments

Comments appear together as a stationary list with full text and a note count. Desktop notes are arranged in three columns in a compact bottom strip. Messages appear above a smaller author/date line; the full timestamp remains available in the time element and its tooltip. Matched outline edit/delete icons sit alongside each message (28px desktop controls, 44px phone targets) and retain their accessible labels and delete confirmation. Automatic rotation, page splitting, and paging controls have been removed. The normal sample notes fit together across the bottom strip without scrolling. Unusually long lists retain readable text and allow manual overflow scrolling, with a visible indicator when more comments remain below; the app does not hide notes or shrink their text to force an unlimited amount of content onto one screen.

Use **Pin On Wall Display** in the existing Add/Edit Comment form to prioritize a notice. Pins are stored by the API and shared across devices. Older records default to unpinned, and older clients that omit the pin field preserve the current choice. Pinned notices appear first in both viewing and editing modes.

Phone layouts let the full comment list expand with the page. Editing, pinning, and deleting retain their existing controls. Equipment tiles remain stationary, and the recent-change border still respects reduced-motion preferences.

## Changes And Connection Health

The moving tile border identifies equipment edited within two minutes. A 6px black track with a hard-edged white sweep provides strong contrast against every status color in either theme, without changing card size. It completes one circuit every four seconds and remains stationary with reduced motion enabled. The footer describes the most recent equipment change within ten minutes, including whether its status or notes changed, its relative age, and the count of other recently updated equipment items. Comment edits do not create equipment-change notices.

**Equipment updated** describes persisted equipment edits. **Last connection check** describes communication with the board API, including SSE heartbeats. The board reports operator-entered equipment availability; it does not represent live running-state telemetry.

EventSource retains its native retry behavior. A watchdog replaces a stream after 65 seconds without activity, checked every ten seconds, with at least 15 seconds between explicit reconnect attempts. Going online, resuming a stale hidden page, and returning through the browser's page cache also reconnect. A restored snapshot repopulates the board even if its first API request failed. Connection loss leaves existing statuses visible with a warning until communication returns.

## Validation

Run `node scripts/check-live-ops.cjs` or `npm run check:ui -- equipment headers`. Checks use temporary API data and cover readable geometry, the full-width equipment layout, persistent header visibility controls, connection warnings with the header hidden, complete static comment text, persisted pin/unpin actions, both themes and contrast, equipment edits and audit history, stream interruption/stall/initial-load recovery, reduced motion, and phone/editor layouts. They do not modify production data.

Release asset version: `20261024-commenthover1`. Local changes require the normal suite deployment to reach the wall monitor.
