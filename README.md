# Auto Updater for CP Tracker Google Sheet

This script automatically fetches your daily accepted submissions from LeetCode, Codeforces, and AtCoder, and logs them directly into your designated tab on the Master Google Sheet.

It tracks the problems you've solved, their difficulties, topics, and automatically generates clickable submission links, avoiding any row duplication.

## Student Setup Instructions

To set this up, you need to create a simple Google Apps Script that calls the central `AutomaticCPTracker` Library. This ensures the script runs under your own Google account, avoiding execution timeouts or rate limits on the master sheet.

### Step 1: Create Your Script
1. Go to [script.google.com](https://script.google.com/) and click **New Project**.
2. Give your project a name (e.g., "My CP Tracker").

### Step 2: Import the Library
1. On the left sidebar, click the **+** icon next to **Libraries**.
2. Paste the following **Script ID** and click **Look up**:
   ```
   1loVbfwQfQtWkaqkJPnU55AdH7x0FcvCExXaK5Nw4V13YNK6wNC9FtWcO
   ```
3. Ensure the version is set to the latest available (or `HEAD`), and make sure the **Identifier** is exactly: `AutomaticCPTracker`.
4. Click **Add**.

### Step 3: Paste the Configuration Template
Delete any default code in your `Code.gs` file and paste the following 5-line configuration block. 

*Make sure to carefully replace the placeholder text with your actual usernames and your tab's exact name.*

```javascript
function myDailySync() {
  AutomaticCPTracker.runSync({
    sheetName: "YOUR_SHEET_NAME",
    leetcode: "your_leetcode_username",
    codeforces: "your_codeforces_username",
    atcoder: "your_atcoder_username",
    masterSheetId: "1VKV9kIzNWpXArqZXlg6xTK3OgvFiqumf9UCqlna2iJA"
  });`
}

```

### Step 4: Authorize and Run
1. Click the **Run** button manually at the top of the editor.
2. Google will ask you to authorize the script to access your spreadsheets. Follow the prompts. *(If it says the app is unverified, click **Advanced** -> **Go to [Project Name]**).*
3. Verify that your sheet tab has been successfully populated with your submissions for the day.

### Step 5: Automate It (Important!)
You don't want to click "Run" every day. Let's set it on a timer.
1. Click the **Triggers** icon (it looks like a clock) on the left sidebar menu.
2. Click **+ Add Trigger** in the bottom right corner.
3. Configure the trigger as follows:
   - **Choose which function to run:** `executeSync`
   - **Choose which deployment should run:** `Head`
   - **Select event source:** `Time-driven`
   - **Select type of time based trigger:** `Day timer`
   - **Select time of day:** Choose a convenient time (e.g., `11pm to Midnight`).
4. Click **Save**.

You are officially done! The library will automatically pull your daily CP history into the shared Master Sheet.
