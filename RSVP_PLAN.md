# RSVP system for manuelynatasha.com

## Rules for whoever builds this (read first)

Where to work: the repo `mannytamayophoto-hash/wedding-mn`, working directory `/home/user/wedding-mn` in a cloud session. Read `CLAUDE.md` and this file. Where this plan and the older "RSVP system" and "Backend architecture" sections of `CLAUDE.md` disagree, this plan wins, and step 1 updates `CLAUDE.md` to match.

This repo is public on GitHub. `wrangler.jsonc` only keeps files out of the website, not out of GitHub. So never commit: the guest list or InviteList, any guest name, email address or phone number, the Gmail password (never ask for it), the Sheet ID, or any key or token. The Apps Script `/exec` URL is the one allowed exception, because it is public by nature and has to sit in `site/js/rsvp.js`. Use invented names in examples and tests.

Branches: master deploys live to the public site within a minute of a push. Step 1 only adds `backend/` and edits `CLAUDE.md`, nothing under `site/`, so step 1 may be committed straight to master. From step 2 onward, work on a branch called `rsvp`. Cut it from `origin/claude/site-quick-wins`, not from master, because that branch (one commit, 20 October 2026: smaller plates, link previews, favicon, lazy loading) already edits `site/rsvp/index.html` and every other page, and master does not have it yet. Never push step 2 or later to master. Manny reviews the preview and merges.

Style rules from `CLAUDE.md` apply to code comments, copy and commit messages: Australian English, no hyphens, en dashes or em dashes. Commit in small steps, push, and stop after each step so Manny can verify.

## Context

The wedding site (`mannytamayophoto-hash/wedding-mn`, deployed from `master` by Cloudflare) has every page built except the RSVP, which is a holding page with a mailto button (`site/rsvp/index.html`). The spec in `CLAUDE.md` (sections "RSVP system", "Backend architecture", build order steps 3 to 5) calls for an invite only RSVP gated by a household code, backed by Google Sheets plus an Apps Script web app under the wedding Gmail, with confirmation emails, edits until 15 January 2027, a reminder to non responders on 1 January 2027, and QR codes per household. About 120 guests across about 55 households, many in Perth and overseas.

This plan is the recommended method and the order of work. It is written so a smaller model can execute each step with little judgement. Nothing has been built yet.

## Decisions made in this plan

1. Household codes are random, six characters, no lookalike letters (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, example `K7M4QX`). The spec's TAMAYO-0412 format is dropped because surname plus four digits is guessable and would leak other families' names. Guests scan a QR or tap a link that prefills the code, so length costs nothing.
2. Per guest answers, not a headcount. The InviteList names each person. The form shows one yes or no per named guest. Plus one slots exist only where a household's `max_party` exceeds its named guests, and appear as a free name field.
3. Static site stays static. No Cloudflare Worker logic, no secrets in the repo. The page calls the Apps Script URL directly. The script URL is public by nature, security comes from the code lookup, lockout and the fact that it returns one household only.
4. Writes are idempotent per household. The Responses tab holds one row per household, updated in place, with a `updated_at` stamp. History is not needed.
5. Manual entries are first class. Manny or Natasha can type a reply straight into the Responses tab for relatives who will never use the form. The form reads it back like any other answer.
6. The hotel room block and airline group rate interest flags ship behind a single `showInterestFlags` constant in the page JS, default off, until those rates are confirmed.
7. The "request an invitation" form (October note, Turnstile feeding the Sheet) is a later phase, after the coded RSVP works. The mailto button stays until then.

## Architecture

```
Guest browser  --fetch POST (text/plain JSON)-->  Apps Script web app  --->  Google Sheet
   site/rsvp/index.html + site/js/rsvp.js          Code.gs (doPost)         InviteList, Responses, Log
                                                      |
                                                      +--> GmailApp confirmation email
                                                      +--> time trigger 1 Jan 2027 reminder
```

Why text/plain: Apps Script cannot answer CORS preflight. A `fetch` with `Content-Type: text/plain` and a JSON string body is a simple request, so no preflight. The script parses `e.postData.contents` itself. GET is used only for the lookup so the URL never carries answers.

## Google Sheet schema

Spreadsheet name: `Wedding RSVP`. Three tabs.

InviteList (one row per guest, households grouped by code)

| col | header | notes |
|---|---|---|
| A | code | six char household code, same on every row of that household |
| B | household | display name, "The Santos family" |
| C | guest_name | one named person, blank rows allowed for open plus one slots |
| D | max_party | integer, repeated per household row |
| E | email | household contact, may be blank |
| F | phone | with country code, may be blank |
| G | channel | how this household is reached: `email`, `sms`, `messenger`, `whatsapp`, `viber`, `inperson` |
| H | segment | `perth`, `manila`, `intl` (drives copy emphasis, optional) |
| I | language | `en` or `tl`, picks which ready to paste message the send list uses |
| J | notes | internal only, never returned |

Households are added at any time. Running `generateCodes` again only fills blank codes, so the list can grow as Manny learns of more households. Email and phone can both be blank, the household still gets a code and a link.

Responses (one row per household, written by the script or by hand)

| col | header |
|---|---|
| A | code |
| B | attending (`yes`, `no`, `partial`) |
| C | guests_json (array of `{name, attending}` as the guest answered) |
| D | headcount (count of yes) |
| E | dietary |
| F | song |
| G | hotel_interest (`yes`/`no`/blank) |
| H | flight_interest |
| I | email (as entered on the form, falls back to InviteList) |
| J | message (free text to the couple) |
| K | source (`web` or `manual`) |
| L | created_at |
| M | updated_at |

Log (append only): timestamp, code attempted, ip hash, outcome. Used for lockout and for seeing who is stuck.

## Apps Script (one file, `Code.gs`, kept in the repo at `backend/Code.gs` for version control, pasted into the script editor by hand)

Functions:

- `doGet(e)`: action `lookup`, param `code`. Normalises (uppercase, strip spaces and hyphens). Checks lockout (more than 8 failed attempts from the same ip hash in 15 minutes returns `{error:"locked"}`). Returns `{household, guests:[{name, attending}], max_party, email, deadline_passed, existing:{...response fields}}` or `{error:"not_found"}`. Never returns notes or other households.
- `doPost(e)`: action `submit`. Parses JSON from `e.postData.contents`. Validates code, that every guest name is in the household's list or an open slot, that yes count is within `max_party`, and that now is before the cutoff in Manila time (`Asia/Manila`, 15 January 2027 23:59). Takes `LockService.getScriptLock()` for the write. Finds the household row in Responses or appends one. Sends the confirmation email if an address exists. Returns `{ok:true}`.
- `sendConfirmation(code, response)`: plain text email from the wedding Gmail, subject "Salamat, your RSVP for 10 April 2027", lists the answers, says they can change it at the link until 15 January, includes the prefilled link.
- `sendReminders()`: run by a time based trigger on 1 January 2027, 9am Manila. For each household in InviteList with no Responses row: if it has an email, sends a short reminder with the prefilled link; otherwise writes it to a `ManualReminders` tab (household, channel, phone, link, ready to paste message) for Manny to send by hand. Writes to Log so a re run cannot double send.
- `exportSendList()`: utility, writes a `SendList` tab with one row per household: household, channel, email, phone, link, and a ready to paste message in the household's language that includes the link. This is how codes reach guests on SMS, Messenger, WhatsApp or Viber. Manny works down the list by hand and ticks a `sent` column. The message wording is the formal Tagalog invitation from CLAUDE.md (Ang Paanyaya) or its English gloss, followed by the link.
- `generateCodes()`: utility run once by hand. For any InviteList row with a blank code and a household name, assigns a fresh random code, same code for consecutive rows with the same household.
- `exportQrList()`: utility, writes a `QR` tab with `code, household, url` where url is `https://manuelynatasha.com/rsvp/?code=XXXXXX`. Feeds step 5.

Constants at the top: `SHEET_ID`, `CUTOFF = "2027-01-15T23:59:00+08:00"`, `SITE_URL`, `FROM_NAME = "Manuel y Natasha"`.

Deployment: Deploy as web app, execute as Me, access Anyone. The resulting `/exec` URL is pasted into `site/js/rsvp.js` as `API_URL`. Redeploying with a new version keeps the same URL when "manage deployments, edit, new version" is used, never "new deployment".

## Front end

Files: edit `site/rsvp/index.html`, add `site/js/rsvp.js`, add a small form block to `site/css/style.css` (reuse `.panel`, `.btn`, `.btn-outline`, `.caption`, `.section-head`, `.reveal`, the double rule invitation frame already used for venue cards).

Page states, all in one HTML file, toggled by JS:

1. Code entry. Single field, Cinzel label "Household code", button "Find our invitation". If `?code=` is in the URL, skip straight to lookup. The field accepts lowercase, spaces and hyphens.
2. Form. Household name as a script heading. One row per guest: name, then two toggle buttons "Dadalo / Attending" and "Hindi makakadalo / Not attending". Open slots show a name input plus the same toggle. Then: email (required, prefilled from InviteList if known, validated as a plausible address on the client and the server, a caption explains it is for the RSVP confirmation and any changes to the day), dietary, song request, message, and the two interest flags when `showInterestFlags` is true. If a response already exists, every control is prefilled and the button reads "Update our reply". Autosave the draft to `localStorage` under `mn_rsvp_<code>` on every change, restore it on load, clear it on successful submit.
3. Confirmation. Letterpress style panel, "Natanggap po namin. Received." with the answers echoed, the cutoff date, and a note that the email is on its way. Keep the wax seal plate (`rsvp-seal.jpg`) at the top of the page throughout.
4. Error states, each a caption line under the field: not found, locked, deadline passed (show the existing answer read only), network failure (keep the draft, say try again).

Copy rule from CLAUDE.md: Tagalog line with an English gloss beneath, no hyphens or dashes, Australian English. Keyboard access on all toggles (real `<button type="button" aria-pressed>`), reduced motion respected, greyscale check before shipping.

Menu: the RSVP nav button on every page already links to `../rsvp/`, no change.

## Click by click steps for Manny (written out in full inside the repo as `backend/SETUP.md` during execution)

1. Sign in to Google as manuelynatashatamayo@gmail.com.
2. Create the Sheet, name it, create the three tabs with the headers above, paste the invite list.
3. Extensions, Apps Script, paste `Code.gs`, set `SHEET_ID`, save.
4. Run `generateCodes` once, authorise when prompted (Advanced, go to project, allow).
5. Deploy, New deployment, Web app, execute as Me, who has access Anyone, copy the URL.
6. Paste the URL into `site/js/rsvp.js`, commit, push.
7. Triggers, add trigger, `sendReminders`, time driven, specific date and time, 1 January 2027 09:00 Manila.
8. Test with one real code on the live site, check the Responses row and the email.

## Two tracks (Manny, October 2026)

Track A, the build, handed to Haiku one step at a time: steps 1, 2, 3, 4, 4b, 4c, 5 below. Step 1 goes to master, steps 2 onward go to the `rsvp` branch (see Rules above). In step 2 the invitation is a plain static letter in the double rule frame above the form, no animation. Haiku stops there and does not attempt 2b or 2c.

Track B, the invitation design, done separately with Manny: steps 2b and 2c, the envelope sequence, the fauna on the letter and the opening film. Track B begins once step 2 is live, so the form and the lookup already work and the design work only touches the letter block and its assets.

Shared contract between the tracks so they do not collide: step 2 renders the letter inside `<section id="invitation" class="invite-letter">` with the household line in `<h2 class="invite-to">`, the Paanyaya in `<div class="invite-body">`, and the form in `<section id="reply">`. Track B replaces the inside of `#invitation` and adds `site/js/invite.js` and `site/css/invite.css`, nothing in `rsvp.js` changes.

## Build order (each step is one commit, one push, verified before the next)

1. `backend/Code.gs` plus `backend/SETUP.md`, and update the "RSVP system" and "Backend architecture" sections of `CLAUDE.md` so they match this plan (random six character codes, per guest answers, required email, three tabs plus SendList and ManualReminders, send channels). Where this plan and the old CLAUDE.md text disagree, this plan wins. Verified by Manny running steps 1 to 5 and curling the lookup URL with a test code.
2. RSVP page and `rsvp.js` against the live script URL, with the invitation shown as a plain static letter above the form. Verified by a full submit, an edit, a wrong code, and the lockout, plus a 390px and greyscale check.
2b. The invitation moment: envelope, seal, letter slide, ink reveal, signature, print stylesheet, per the design brief above. Own commit. Verified at 390px, in greyscale, with reduced motion on, and with the skip tap.
2c. The opening film: generate the letter handover plate, test the kalesa shot, then the remaining shots, stitch, encode, wire into the page with the match cut and the playback rules above. Manny approves each shot before stitching.
3. Confirmation email wording and the reminder function. Verified by a dry run flag in `sendReminders` that logs instead of sends.
4. Mail merge: `sendInvites()` in Code.gs emails every household with `channel = email` its link and message from the wedding Gmail, marks `sent` in SendList, skips rows already marked. Dry run flag first.
4b. SMS from Manny's Mac: `backend/sms/send-sms.applescript` (or a short Python script using `osascript`) reads a CSV export of SendList, and for each row with `channel = sms` sends the message through the Messages app, which forwards SMS via Manny's iPhone (Text Message Forwarding on). Setup notes in `backend/SETUP.md`: enable forwarding, test with Manny's own number, send in batches of about ten with a few seconds between. Twilio or ClickSend noted as the fallback only if forwarding is unavailable. Messenger, WhatsApp and Viber rows stay manual from SendList.
4c. Request an invitation form with Turnstile (replaces the mailto). Separate plan, after the above is live.
5. QR codes: a Python script in `backend/qr/` that reads the exported QR tab CSV and writes one SVG per household, named by code, for the printed invites.

## Verification

- Lookup with a valid code returns only that household.
- Submit with a yes count above `max_party` is rejected server side.
- Submit after the cutoff is rejected server side regardless of client clock.
- Two near simultaneous submits for the same code leave one row.
- A row typed by hand in Responses shows up prefilled on the form.
- Confirmation email arrives from the wedding Gmail with a working prefilled link.
- Page passes keyboard only use, `prefers-reduced-motion`, a `grayscale(1)` check and no horizontal scroll at 390px.

## The RSVP page is the invitation (Manny, October 2026)

The public site is an announcement, not an invitation. Only a household that opens its own code link should feel invited. So:

- Move the formal Ang Paanyaya card off the public landing page. The homepage keeps the save the date card (Ilaan po ang Araw) and the countdown, which read as news, not as a personal invitation. Soften any public copy that says "you are invited" into "we are getting married on".
- On the RSVP page, after a valid code lookup, the first thing the household sees is their invitation: the double rule invitation frame, the household name in Pinyon Script ("Para kina Ana at Ben" / "For Ana and Ben"), then the Ang Paanyaya wording from CLAUDE.md with its English gloss, then the date, church and reception lines. The RSVP form follows beneath it on the same page, so the invitation and the reply are one piece of correspondence.
- The confirmation email carries the same invitation text above the answers, so the email doubles as the keepsake invitation.
- The code entry state (before lookup) is neutral: the seal plate, "Tugon", the code field, and the open note below.

### The invitation moment, design brief (Manny, October 2026, "a very nice invitation page with animation")

Built in CSS and SVG, no video required, about six seconds, plays once per visit (sessionStorage flag `mn_invite_seen_<code>`), reduced motion shows the finished letter immediately. Everything uses the locked palette, type and plate language. No feathering, no parallax, no sound.

Sequence:
1. Envelope. Ecru envelope (SVG, gold hairline edges, subtle paper shadow) centred on the weathered paper. The flap carries a wax seal in wine, bearing the MN script ligature (assets/engravings/monograms/01-script-ligature.png, multiply blend). The seal presses in (scale 1.06 to 1, shadow bloom) then cracks (two seal halves rotate apart a few degrees and fade).
2. Flap opens (rotateX on the flap, 0.6s) and the letter slides up out of the envelope (translateY, 1.0s, ease out), then the envelope fades back and the letter settles centre with a soft drop shadow.
3. Ink reveal, in order, each about 0.5s apart: the double rule invitation frame draws itself (SVG stroke dashoffset), the baybayin mahal band fades in gold, the household line "Para kina Ana at Ben" (Pinyon Script, 28px or more) writes in via clip path, the Ang Paanyaya paragraph soaks in line by line (opacity plus 2px blur to 0, same as the homepage hero ink reveal), the English gloss, then the date, Iglesia de San Agustin and Diamond Hotel lines in Cinzel.
4. Signature. The existing sign wipe animation on logo-signature.png, same timing as the homepage.
5. A caption "Mag scroll po upang tumugon" with gloss "Scroll down to reply" fades in beneath, and the form follows on the same page.

Household line wording: for one guest "Para kay Mateo", for two "Para kina Ana at Ben", for three or more "Para sa pamilya Santos" using the household name as entered. English gloss "For Mateo", "For Ana and Ben", "For the Santos family".

Keepsake: the letter has a print stylesheet (hides nav, envelope, form, music toggle, prints the letter at A5 centred on the page) and a "Save this invitation" button that calls window.print().

### Opening film, 12 seconds (Manny, October 2026, "a 10 to 15 second animation of the plates leading into the invite being handed over")

A silent animated prologue made from the existing engraving plates, playing once before the envelope sequence. The rule that makes it work: the film's final frame IS the starting state of the CSS envelope, a match cut, so the handover feels like one gesture.

Shots, 15 seconds total, monochrome burnt umber on ecru, ink dissolves between them, no text in the film. Fauna rules from the design spec hold: animals are cameos inside a scene, never framed statements, and the kangaroo and carabao never appear together.
1. 0 to 3s, intramuros-panorama: slow push in, drifting cloud, a few birds.
2. 3 to 6s, kalesa: horse walks, wheels turn, passes the San Agustin arch, slight sway and dust. A carabao stands at the roadside and turns its head as the kalesa passes (generate a variant of the kalesa plate with the carabao added, same house style, or composite the carabao in).
3. 6 to 9s, quokka-tarsier (the FAQ plate): the tarsier blinks, the quokka grins, a rooster (tandang, in etching style) struts in from the frame edge and crows with its head back, silent.
4. 9 to 12s, harana: guitarist's hand strums, the woman at the window turns toward him.
5. 12 to 15s, new plate "letter handover": two hands, a barong cuff and a lace cuff, hold one sealed letter toward the viewer, MN wax seal visible, lower it onto the paper, withdraw, hold on the letter. Generated in the house style with the standard prompt anchor. The last frame is exported as a PNG and becomes the envelope image the CSS sequence animates from.

Fauna on the finished letter (part of step 2b, CSS only): after the reveal completes, kangaroo-spot.png hops in from the right margin and settles beside the signature with a slow idle (ear flick every few seconds, three or four frame sprite or keyframed transforms), and quokka-spot.png peeks up from the bottom left corner. This is the kangaroo's new home after the Los Mapas cut. Reduced motion shows both sitting still in place. They stay out of the print stylesheet.

Production: image to video per plate (Higgsfield or equivalent, Manny approves each shot), three to four seconds each, stitched with ink dissolves. Test the kalesa shot first, a walking horse in etching style is the hardest shot; if it fails, drop to a slow push in on that plate rather than a bad animation. Deliver as WebM (VP9) plus MP4 (H.264) fallback, 720p, target under 4MB, poster image set to the first frame.

Playback rules: loads only on the RSVP page after a valid code, never on the homepage. `muted playsinline preload="none"`, started by script once the lookup returns. Plays once per visit (`mn_film_seen_<code>` in sessionStorage). Any tap or key press skips to the envelope sequence. `prefers-reduced-motion` skips the film and the envelope sequence entirely and shows the finished letter. If the video has not reached `canplay` within 1.5 seconds, skip it and go straight to the envelope sequence. No sound in the file, the Musika loop carries audio if the guest has it on.

Build order: this is step 2c, after the CSS envelope sequence (2b) is working, so the match cut target exists before the film is made.

Greyscale check, 390px check and keyboard check apply as on every page. The whole animation must finish within seven seconds, and a tap or key press anywhere skips to the finished letter.

## Open note for people without an invitation

On the RSVP code entry state, below the field, and repeated on the FAQ page, a short gracious note: Tagalog first, English gloss beneath. Sense of it: we wish we could have everyone, the room holds a fixed number, if you have not received a code and would like to come, send us an email and we will do our best. The email link is the wedding Gmail with a subject of "Invitation request". Copy to be written in the voice rules of CLAUDE.md, no hyphens, read aloud test. This replaces the current mailto "Send us your details" button, which goes once the coded form is live.

## Invite list (private, never in this repo)

The real guest list lives in Manny's Google Drive only. A first InviteList in the column layout above exists there as "Wedding RSVP InviteList (draft)", already grouped into households with notes on what is still unconfirmed. About 80 households and 140 seats. Open points to settle before codes are generated: reserved seats held for guests whose names are not known yet, one or two households listed as separate people who may live together, a pair of identical first names that may or may not be the same person, children counts, and a couple of entries that still need full names. In step 1, Manny pastes that tab into the Wedding RSVP sheet as InviteList after tidying. Nobody commits it, and no session needs Drive access to do the build.

## Email capture for SMS and Messenger households

The code link is the only sign in, there is no email login. The RSVP form is where emails are collected. Email is required on the form for every household. When a household has no email in InviteList, the field sits first, above the guest toggles, with the Tagalog line "Ilagay po ang email ninyo para sa kumpirmasyon" and the gloss "so we can confirm your RSVP by email". The submit button stays disabled until a valid address is entered, and `doPost` rejects a submit without one. On submit, the script writes the entered email into Responses column I and, if InviteList column E was blank, copies it there too. `sendReminders`, `exportSendList` and any later mail merge read the email from InviteList, so a household moves from manual to email automatically after its first reply.

## Known limitations, accepted

- Every household that replies has an email, since the form requires one. The automatic reminder and SendList still need the manual path for households that have not replied yet and were only ever reached by SMS or Messenger.
- Responses typed by hand into the Responses tab may have no email. That is fine, the script skips the confirmation for those.
- Total household count is unknown. Nothing in the design depends on it.

## Open items to settle before step 2 is written

- Kids and plus ones policy, which decides how many open slots households get.
- Whether to show the hotel and airline interest flags at launch (default off).
- Final Tagalog copy for the form and emails, to be read by a native speaker before launch.
