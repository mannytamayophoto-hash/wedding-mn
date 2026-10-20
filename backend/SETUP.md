# RSVP backend setup

These steps are for Manny, done once in the wedding Google account. Nothing here needs the repo or any code editing except copying one file. Work through them in order.

Keep these private: the spreadsheet link, the Sheet ID, the web app URL until step 7, and any guest details. Never paste them into GitHub, into a chat with anyone outside the wedding team, or into a public document.

## Before you start

You need:

1. The wedding Google account, signed in in your browser. Use a normal browser window, not a private one.
2. Your private draft of the invite list, the one kept in your Google Drive. Keep it open in another tab.
3. The file `backend/Code.gs` from the GitHub repo. Open it on GitHub, click the Raw button, then select all and copy the text.

## Step 1. Create the spreadsheet

1. Go to sheets.google.com and click Blank.
2. Click the file name at the top left and rename it to Wedding RSVP.
3. Rename the first tab to InviteList. Click the tab name, choose Rename, and type InviteList.
4. In row 1 of InviteList, type these headers, one per cell from column A to column J:

   code, household, guest_name, max_party, email, phone, channel, segment, language, notes

5. Add a second tab with the plus button at the bottom left. Rename it to Responses. In row 1, type these headers from column A to column M:

   code, attending, guests_json, headcount, dietary, song, hotel_interest, flight_interest, email, message, source, created_at, updated_at

6. Add a third tab and rename it to Log. In row 1, type these headers from column A to column C:

   timestamp, code, outcome

The tabs SendList, ManualReminders and QR are created by the script itself, so you do not make them.

## Step 2. Fill in the invite list

1. Click the InviteList tab.
2. Copy the rows from your private draft and paste them starting in row 2, keeping the same column order.
3. Leave the code column blank for now. The script fills it in at step 5.
4. Keep each household's rows together, one row per named person. Leave the guest_name cell blank on a row if you want to hold an open seat for a plus one. Set max_party to the most people that household may bring, repeated on every row for that household.
5. Use these values for channel: email, sms, messenger, whatsapp, viber or inperson.
6. Use en for English or tl for Tagalog in the language column.

This sheet holds real names and contact details. Keep the spreadsheet link private.

## Step 3. Open the script editor

1. In the spreadsheet, click Extensions in the top menu, then Apps Script.
2. A new tab opens with a file called Code.gs containing a placeholder function. Click inside it, press Command and A to select everything, then Delete.
3. Paste the text you copied from GitHub in the Before you start section.
4. Find the line that starts with `const SHEET_ID` near the top. Replace the text PASTE_SHEET_ID_HERE with the Sheet ID. The Sheet ID is the long string in the spreadsheet address between `/d/` and `/edit`. Keep the quote marks around it.
5. Press Command and S to save.
6. Click the project name at the top left, rename it to Wedding RSVP, then press Enter.

## Step 4. Set the time zone

1. In the left menu, click the gear icon labelled Project Settings.
2. Under Time zone, choose Asia/Manila (GMT+08:00).
3. This matters because the 15 January 2027 cutoff and the 1 January 2027 reminder are both Manila times.

## Step 5. Create the household codes

1. Click the Editor icon in the left menu to go back to the code.
2. In the toolbar, use the function dropdown and choose generateCodes.
3. Press Run.
4. A window asks you to authorise the script. Choose Review permissions, pick the wedding account, then click Advanced and Go to Wedding RSVP. Click Allow. Google shows this warning because the script is new and private, not because anything is wrong.
5. Go back to the spreadsheet. Every household now has a six letter code in column A of InviteList, with the same code on each row for that household.

You can run generateCodes again later when you add households. It only fills in blank codes, so codes already given out never change. Keep each household's rows together so they share a code.

## Step 6. Publish the web app

1. In the script editor, click Deploy at the top right, then New deployment.
2. Click the gear icon beside Select type and choose Web app.
3. Set Description to RSVP v1.
4. Set Execute as to Me.
5. Set Who has access to Anyone.
6. Click Deploy. If asked, authorise again the same way as step 5.
7. Copy the Web app URL. It ends in `/exec`. Keep it in a private note for now. It goes into the website in a later step.

To change the code later, do not choose New deployment, because that gives a new URL. Instead, click Deploy, then Manage deployments, click the pencil icon, choose New version under Version, and click Deploy. The URL stays the same.

## Step 7. Test the lookup

1. Pick a real code from column A of InviteList.
2. Open a browser window and paste this, replacing the two parts in capitals. Keep the question mark and the ampersand:

   WEB_APP_URL?action=lookup&code=HOUSEHOLD_CODE

3. You should see text starting with `{"household":`. It lists only that household, with its named guests and the number of open seats. If you see `not_found`, check the code has no typos and that step 2 is done.

Do not share the test link. It shows the household's details.

## Step 8. Dry run the emails

The script has a switch called DRY_RUN, set to true when you first paste it. While it is true, nothing is emailed. The script only writes what it would have sent to the execution log.

1. In the script editor, choose sendReminders from the function dropdown and press Run.
2. Click Execution log at the bottom of the screen. You should see lines starting with DRY RUN, one per household that has an email and has not replied.
3. Check the ManualReminders tab in the spreadsheet. It lists households without an email address, with the link ready to copy into a text message or Messenger.

Only after the log looks right, change DRY_RUN in the script editor from true to false, then click Save. Keep it true until then.

## Step 9. Set the 1 January reminder

1. In the script editor, click the clock icon labelled Triggers in the left menu.
2. Click Add Trigger.
3. Set the function to sendReminders.
4. Set the event source to the timer option, the one that runs on a set date and time.
5. Choose Specific date and time, enter 1 January 2027 at 9:00am, and click Save.

The reminder runs once. It emails only households that have an email and have not replied, and writes the rest to ManualReminders. It can run twice safely, because each reminder sent is logged.

## What the tabs do

- InviteList: the private list. Only you and Natasha edit it.
- Responses: one row per household. Guests answer on the website, and the script writes here. You can also type a reply by hand for a relative who will never use the form. Set source to manual so it is clear.
- Log: records failed code lookups and sent reminders. It holds codes and outcomes only, no names or emails.
- SendList: created by the script when you run exportSendList. It has one message per household, ready to paste, with a sent column for you to tick.
- ManualReminders: created by the script on each reminder run, for households with no email.
- QR: created by the script when you run exportQrList. It feeds the printed invitations later.

## If something goes wrong

- Error "Missing tab": one of the three tabs in step 1 has a different name or is missing. Check the spelling exactly.
- Error "Authorisation required": run the function again and authorise as in step 5.
- The lookup says locked: too many wrong codes were tried in the last 15 minutes. Wait 15 minutes. The lock applies to everyone, because the script cannot see who is asking.
- A household asks for a new code: do not change the code. Ask Natasha or Manny to check the household in InviteList, then send the existing code.

## Things never to do

- Do not paste the spreadsheet link, the Sheet ID or the web app URL into GitHub or any public place.
- Do not share your Google password with anyone or put it in a file. The script never needs it.
- Do not create a New deployment for a change. Use New version instead.
