# Auto Updater for CP Tracker Google Sheet

A scalable Google Apps Script solution to automatically fetch daily accepted submissions from LeetCode, Codeforces, and AtCoder and log them directly into a designated Google Sheet tab for each user. 

It keeps track of the problems solved, difficulties, topics/tags, generates clickable submission links, and avoids row duplication by cross-referencing past submissions.

---

## Features
- **Multi-Platform:** Supports LeetCode (GraphQL), Codeforces (API), and AtCoder (Kenkoooo API).
- **Auto Data Validation:** Copies existing Dropdown Chips (like "Easy", "Medium", "Hard") from a designated master cell on the sheet to keep your tracker looking beautiful.
- **Robust Backup & Sync System:** Maintains a separate hidden Backup Sheet mirror for each student. If a student's public sheet gets corrupted or tampered with, the script will self-correct by resyncing from the pristine backup state every runtime.
- **Library Architecture:** Designed to be hosted centrally by a repository maintainer/admin. End users simply import it via a Library ID within their own Google Apps Script account, thus executing API fetching without bumping into execution timeouts or API rate limits on a centralized server.

---

## Project Files
- `autoupdater.gs`: The standard library that tracks all 3 platforms, merges the Problem and Submission links into a single unified Markdown-style column (Col B:C merged).
- `autoupdater1.gs`: An alternative version of the script which generates **separate** columns for the Problem URL (Col B) and the actual Submission URL (Col C) instead of merging them. 

---

## Admin / Maintainer Setup

If you are setting this up as the "Master Script" (e.g., maintaining the open-source library for a group of students):

1. Go to [script.google.com](https://script.google.com/) and click **New Project**.
2. Copy and paste the contents of `autoupdater.gs` (or `autoupdater1.gs` if you prefer the split column layout) into your `Code.gs` file.
3. Save the project and give it a name.
4. Click **Deploy > New Deployment**.
5. Choose **Library** as the type. Add a description, and deploy.
6. Share your project's **Script ID** (found in Project Settings gear icon > Script ID) with your users/students. Have them follow the next step.

## End User / Student Setup

If your admin has given you their Script Library ID, here is how you automate your own specific Google Sheet Tab.

1. Create a pristine standalone script at [script.google.com](https://script.google.com/). 
2. Click the **+** icon next to **Libraries** on the left menu.
3. Paste the **Script ID** provided by your admin and click **Look up**. Select the latest version and click **Add**. *(Assume the identifier defaults to the name your admin chose, for example, `CPTracker`)*.
4. Replace the code in your script space with the following block:

```javascript
function executeSync() {
  const config = {
    masterSheetId: "1YOUR_SPREADSHEET_ID_HEREQ2w_3e4r", // The ID from your Google Sheet URL
    sheetName: "YOUR_SHEET_TAB_NAME",
    leetcode: "your_leetcode_username",
    codeforces: "your_codeforces_username",
    atcoder: "your_atcoder_username"
  };

  // Run the library's main sync function using your configured variables.
  // Replace 'CPTracker' with whatever the Library Identifier name is.
  CPTracker.runSync(config); 
}
```

5. **Authorize the script!** Click the **Run** button manually once to grant the script read/write access to your Spreadsheet. (Google will warn you that the app is unverified; click Advanced > Go to Script).
6. **Set up automation:** Click on the **Triggers (Clock)** icon on the left sidebar. Add a new trigger:
   - Choose function: `executeSync`
   - Event source: `Time-driven`
   - Type: `Day timer`
   - Time of day: `11pm to Midnight` (Or any time you prefer).
   
You are done! The library will automatically pull your daily history without any further required input.
