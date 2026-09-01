# Wedding website — Manuel Tamayo y Natasha Trenear

Project instructions for this directory. Follow this spec and build order exactly. Australian English throughout. No hyphens, en dashes, or em dashes anywhere in site copy, code comments, or commit messages, use commas or restructure the sentence instead.

## The essentials

- Couple: Manuel Tamayo y Natasha Trenear
- Date: Saturday 10 April 2027
- Ceremony: San Agustin Church, Intramuros, Manila, 4:00 to 5:00pm
- Reception: Diamond Hotel Manila, Constellation Room
- Scale: approximately 120 guests, approximately 55 households, heavy Perth and international contingent
- Domain: manuelynatasha.com (confirmed by Manny, July 2026)
- Dedicated Gmail for the backend: manuelYnatashatamayo@gmail.com. The password is NOT stored anywhere in this repo on purpose, Manny enters it himself during the phase 3 Google setup steps. Never ask for it, never store it.
- RSVP cutoff: 15 January 2027

## Design direction, LOCKED (decided with Manny, July 2026)

Filipiniana heritage, Spanish Filipino register, Old Manila engraved folio. The whole site reads as an antique book plate collection that happens to be alive. The reference build is design-directions/consolidated.html, keep it working, it is the visual contract.

**Palette, locked**: ecru #F5EDDD base, wine #6B1E36, burnt orange #C1552C, gold #C9A227, ink #2B2B2B. Wine is display only, script and logo moments, never body text and never small labels (it merges with ink in greyscale). Gold stays linework, borders, motifs. Burnt orange carries labels and small accents. Ink does the reading.

**Accessibility constraint, non negotiable**: the site owner is colour blind. Tonal hierarchy (contrast and value, not hue) must hold up in greyscale. Every page must be checked with a grayscale(1) filter before it ships. Respect prefers reduced motion on every animation.

**Type package, locked, all Google Fonts**:
- Pinyon Script, names and section script headings only, never below about 24px
- Cinzel, headings, labels, inscriptions, buttons, uppercase letterspaced
- IM Fell English Italic, antique English subtitles and captions, mixed case
- Alegreya, all body copy
- Noto Sans Tagalog, baybayin accents, gold, always paired with a small translation gloss. The word used is mahal (love), rendered U+170B U+1711 U+170E U+1714. Call the script baybayin in copy, never alibata.

**Logo, working version, NOT final, revisit before launch**: engraved copperplate "Manuel y Natasha" with script "Tamayo" beneath. Wide variant for desktop hero, stacked variant for mobile and print, both in assets/engravings/monograms/. Companion mark is the interlocked script MN ligature (01-script-ligature.png) for favicon and seal duty only. Before production use, cut the calligraphy from its paper background (remove background) so it sits clean on ecru. Rejected explorations live in the unused subfolders.

**Illustration system, locked**: antique copperplate engraving plates, monochrome burnt umber on ecru, generated with Nano Banana Pro. House prompt anchor: "fine crosshatched etching linework, monochrome burnt umber sepia ink on plain flat aged ecru paper background, isolated book plate vignette fading softly into the paper, no text, no border". All plates live in assets/engravings/ as 2k PNGs. Blend into pages with mix-blend-mode multiply plus a radial gradient mask so plates dissolve into the paper, never sit as rectangles. Current set: intramuros-panorama (hero band), san-agustin (ceremony arch), kalesa (ceremony vignette), harana (Nuestra Historia), barong-terno (dress code header), barong-gentlemen and filipiniana-ladies (dress code split, man bare headed, women showing ready to wear options), diamond-hotel (reception), jeepney (transport), jet-manila-bay (travel), bangka-sunset (things to do), route-chart (travel map, note the Pacific and Indian labels are swapped, decorative only). Pearl and Southern Cross theme is REJECTED, do not reintroduce it.

**Landing page look, settled after two rounds of Manny's critique (July 2026)**:
- Backdrop is old weathered paper: assets/textures/weathered-paper.jpg applied as a fixed, cover sized body::before overlay, multiply, opacity about 0.5. NEVER tile a paper texture, tiling shows torn seams. The capiz CSS grid is retired for backgrounds (read as graph paper).
- NO FEATHERING, banned site wide. No radial gradient masks on plates. Plates sit as full rectangles with mix-blend-mode multiply, reading as prints mounted in an atlas. Manny explicitly rejected the feathered vignette look.
- Logo is the ORIGINAL wide copperplate calligraphy, logo-manuel-y-natasha-wide.png, unfeathered, reading as a pasted bookplate label. The heraldic crest (crest.png) and cartouche (logo-cartouche.png) are OFF the site, kept as alternates for print, seals and stationery only. The kangaroo and carabao pairing as messaging is rejected, do not pair those two animals or use kangaroo-carabao.png on the site.
- Fauna appear as scattered margin elements, not framed statements: assets/engravings/spots/kangaroo-spot.png and quokka-spot.png (transparent cutouts) placed small, kangaroo under the Los Mapas section, quokka as the footer tail ornament. quokka-tarsier.png remains the FAQ plate.
- Copy weaves Tagalog prominently alongside the Spanish, always with an English gloss nearby. The hero eyebrow is Ang Kasal, not La Boda. Manny rejected poetic taglines as corny (dos orillas isang puso, and the girl from the western shore line are both DELETED, do not resurrect). Copy must be direct: Natasha is from Perth, Manuel is from Manila, facts stated plainly.
- The page top and foot band is the baybayin inscription band, repeating mahal kita (U+170B U+1711 U+170E U+1714, U+1703 U+1712 U+1706) in gold between hairlines. The woven embroidery band is retired from page tops.
- A formal Tagalog invitation card (Ang Paanyaya) sits on the landing page: "Buong galak po namin kayong inaanyayahan sa aming kasal, sa ikasampu ng Abril, dalawang libo dalawampu't pito, ikaapat ng hapon, sa Simbahan ng San Agustin, Intramuros, Maynila." with an English gloss beneath. Reuse this wording wherever a formal invitation is needed.
- The church is styled Iglesia de San Agustin in display lines, with the researched history line: Simbahan ng San Agustin, founded 1571 as the Iglesia de San Pablo, the oldest stone church in the Philippines. Source: Wikipedia San Agustin Church (Manila).
- Route chart v3: exactly three routes, Perth, United States (no San Francisco label), Tokyo. Singapore removed at Manny's request. Spanish map labels (Islas Filipinas, Oceano Pacifico, Mar del Zur, Carta Maritima cartouche). Older versions archived as route-chart-v1/v2.
- The hero is a save the date invitation card (.save-card) in DEEP TAGALOG at Manny's request: heading Ilaan po ang Araw (set aside the day), glossed save the date and guardad la fecha, body in poetic deep Tagalog (revised at Manny's request, the plain version was rejected): "Sa awa ng Maykapal at taglay ang basbas ng aming mga pamilya, pagbubuklurin po ang aming mga puso sa harap ng dambana ng Simbahan ng San Agustin, Intramuros, Maynila, sa pagsapit ng ikasampu ng Abril, taong dalawang libo dalawampu't pito." with a small English gloss beneath, then the couple's signature. Deep vocabulary in play: Maykapal (the Creator), basbas (priestly blessing), pagbubuklurin (hearts bound as one), dambana (altar), pagsapit (the arriving of a day). Have a native Tagalog speaker review before launch. The signature is logo-signature.png (background removed logo) with CSS brightness 1.24 contrast 1.08 plus multiply so only ink shows, edges cropped by clip path, and a sign-wipe keyframe animation (left to right clip reveal, 2.4s, 1.3s delay) so the card signs itself on load. Reduced motion shows it complete.
- Church naming verified online: Simbahan ng San Agustin is the correct Filipino name, the official designation is Immaculate Conception Parish, San Agustin Church (UNESCO), also the Archdiocesan Shrine of Our Lady of Consolacion y Correa. Founded 1571 as Iglesia de San Pablo.
- Logo still awaiting Manny's final sign off.

**The Australia thread**: Manuel and Natasha met in Australia, and the design carries this as accents inside the same engraving language, never as a theme change. Three plates exist: wattle-sampaguita-garland.png (the two national flowers woven into one garland, use as the divider on Nuestra Historia and anywhere the union itself is the subject), black-swan.png (the Swan River, opens the Perth chapter of Nuestra Historia), quokka-tarsier.png (the fun plate, quokka and tarsier side by side, use at the top of the FAQ as the welcoming committee of the two shores, caption in IM Fell italic). Old Manila remains the world of the site, Australia enters through the story and small systemic touches. Any future Australiana must be rendered as colonial naturalist engraving, subjects are free, the rendering is not.

**Structural elements, locked**: arched image frames for all photography (border radius top, gold rule, echoing San Agustin's doors), capiz grid background texture on alternating sections, gold embroidery band bookending page top and footer, sampaguita garland dividers, baybayin dividers, double rule invitation frames for venue and RSVP cards.

**Photography treatment (when prenup arrives)**: retrato style, warm sepia leaning duotone, arch mask, faint paper grain, thin gold frame, IM Fell italic caption like a museum label. The engraved panorama stays the permanent hero, photos live in arches below, they do not replace the illustration identity.

**Voice**: English body copy with both Spanish Filipino and Tagalog accents used deliberately. Spanish register for the formal architecture (La Boda, Nuestra Historia, El Vestuario, Los Mapas, La Ceremonia). Tagalog for the warm and human moments (mahal, salamat, halina at magdiwang, kasal, pamilya, tuloy po kayo). Every non English word gets context or a small gloss nearby so international guests are never lost. Warm, personal, not stiff. Australian English. No hyphens or dashes anywhere in copy.

## Experience blueprint for the build (step 2 onward)

Gifts policy, DECIDED (Manny, July 2026): money is preferred, cash is welcome. Explicitly no physical gifts, the couple are travelling and cannot carry things home. Phrase this graciously on the FAQ and a small Regalos note, presence over presents, and if guests wish to give, a contribution toward the honeymoon or their life together is the kindest. A Filipino money tree or pabitin style note fits the register. Do not build a physical registry.

Photo afterlife, DECIDED to include, approach chosen: a curated gallery Manny builds after the wedding (retrato treatment, arched frames, his own edit, since he is the photographer and controls quality) as the main event, plus a single Comparte tus fotos link to a shared Google Photos album so guests can drop their own candids without any custom upload backend. The album link reuses the wedding Google account already being stood up. Build the gallery page shell now (empty, elegant placeholder, coming after the wedding), wire the album link at phase 3.

Song / gramophone: CUT. No song, remove the gramophone idea entirely from the blueprint.

Signature moments, in priority order:
1. Ink reveal on first load, hero elements fade up like ink soaking into paper, CSS only, about two seconds, once per session
2. View Transitions API crossfades between pages, logo as the shared element, like turning plates in a folio
3. Travel page route chart with scroll linked dotted routes drawing from Perth, San Francisco and Singapore toward Manila
4. El Programa, the wedding day as an engraved road from church to hotel, the kalesa travels along it as you scroll
5. Things to Do panorama as an annotated antique map, numbered legend, tap to open each spot's plate card
6. RSVP as correspondence, wax seal press animation, letter slides out, letterpress style confirmation
7. Folio details: Roman page numbers, IM Fell drop caps, footer colophon, print stylesheet so the site prints as a keepsake booklet

Functionality bar: static and sub second (subset self hosted fonts, AVIF images, lazy loading), countdown in Manila time with the guest's local time beneath and an add to calendar ics, QR deep links per household prefill the RSVP code and can segment content (Perth households see travel emphasis, Manila households see transport and dress sourcing), RSVP autosaves locally, full keyboard access.

Refused on principle: autoplay music, preloader screens, cursor gimmicks, parallax overload, chatbots.

## Site map

1. Home / Save the Date, countdown to 10 April 2027, 4:00pm Manila time
2. Nuestra Historia (our story)
3. Ceremony, map, arrive by 3:30pm, note about cobblestone footwear
4. Reception, map, transport, shuttle TBC
5. Travel (see below)
6. Things to Do in Manila (see below)
7. Dress Code, Filipiniana (see below)
8. RSVP, phase 2 build
9. FAQ
10. Updates archive

## Travel page content

- Philippine Airlines PR224 is the only full service direct flight Perth to Manila, approximately 7 hours, approximately 3 times weekly, from approximately AUD $712 return. Recommend arriving Wednesday 7 April. Flag clearly on the page that the April 2027 schedule must be re verified before publishing, schedules this far out are not final.
- Jetstar JQ81 is the budget direct option.
- One stop options: Singapore Airlines, Cathay, Scoot, Malaysia Airlines.
- Same timezone as Perth, zero jet lag. Book 3 or more months ahead.
- Diamond Hotel Manila is the recommended hotel. Room block rates TBC, airline group rates TBC. Both register interest via the RSVP form once it exists.
- Weather: early April is dry season, 33 to 34 degrees Celsius.
- Practical box: eSIM options (Smart, Globe), Grab app for transport, GCash versus cash, tipping norms, power (220V, Type A/B/C plugs), do not drink tap water, passport needs 6 months validity from date of travel.

## Things to Do in Manila page content

- Walkable from Intramuros: Fort Santiago, Casa Manila, bambike tours, San Agustin Museum
- National Museum, free entry
- Rizal Park
- Manila Bay sunset
- Half day trips: Binondo food crawl, Poblacion Makati, SM Mall of Asia
- Day trips: Tagaytay and Taal, Corregidor, Pagsanjan Falls
- Extend the trip: Palawan, Cebu, Boracay, Siargao

## Dress Code, Filipiniana page content

- Men: Barong Tagalog, pina or jusi fabric, worn untucked by design, white undershirt, dark trousers, no jacket, no tie.
- Women: Terno or Filipiniana style, butterfly sleeves, Maria Clara as an alternative silhouette, avoid white on white, ecru, earth tones, and burnt orange all welcome.
- A graceful out for guests without access to Filipiniana: formal, warm neutrals are fine.
- Reference links: kulturafilipino.com, barongwarehouse.com, vintagallery.com, barongsrus.com. Kultura at SM Mall of Asia is a good option for guests arriving early.
- Order 6 or more weeks ahead.
- Entourage reserved colour: TBC.

## RSVP system (phase 2 build)

- Invite only. Unique code per household, format TAMAYO-0412, tied to a maximum party size.
- No code, no RSVP.
- Editable up to the 15 January 2027 cutoff.
- Fields: attending yes/no, headcount within the household maximum, guest names, dietary requirements, song request, interest flag for the Diamond Hotel room block (TBC), interest flag for airline group rates (TBC).
- Automated confirmation email on submit.

## Backend architecture

- Database: Google Sheets under the dedicated Gmail manuelYnatashatamayo@gmail.com, two tabs, InviteList and Responses.
- API layer: Google Apps Script web app, also handles mail merge for segmented announcements.
- Automated reminder to non responders on 1 January 2027.
- Hosting: HostGator business account (cPanel), NOT Cloudflare Pages, changed when Manny confirmed he already holds HostGator, the domain manuelynatasha.com, and the Gmail. Deploy by uploading the static site/ folder via File Manager or FTP, no build step needed since it is plain HTML/CSS/JS. Enable free AutoSSL in cPanel so the site runs on https. Site itself is public, RSVP is gated by household code.
- QR codes on printed invites, each one encodes the invite URL with the household code prefilled.

## Build order

Work through these in order. Do not skip ahead.

1. Design direction page, 2 to 3 distinct directions (palette, type, M y N monogram concepts), serve locally, wait for Manny's pick before building anything else.
2. Static pages with illustration and motif placeholders. No real photos yet, prenup shoot is still pending.
3. Apps Script plus Sheets plus RSVP page. Provide click by click steps for every part Manny has to do himself in the Gmail and Google Cloud console, do not assume access to his Google account.
4. Mail merge and reminder automation.
5. QR code generation from the invite list CSV.

## Open items, do not block on these

Shuttle details, kids and plus ones policy, entourage names, cocktail hour timing, photos (prenup pending), final logo sign off (current logotype is a working version, Manny will finalise eventually), entourage reserved colour.

Resolved: domain is manuelynatasha.com, backend Gmail is manuelYnatashatamayo@gmail.com (Manny holds the password, never store it in this repo), hosting is Manny's HostGator business account with Cloudflare Pages as the alternative, gifts policy is money preferred (see above). Confirmed guest origin cities so far: Perth, San Francisco / USA, Tokyo / Japan, Singapore, the route chart and travel copy include all four.
