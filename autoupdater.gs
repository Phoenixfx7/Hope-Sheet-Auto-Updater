  function mainPhoenix() {
    const leetcodeUsername = "vaibhavsriram";
    const codeforcesUsername = "vaibhavsriram";
    const atcoderUsername = "vaibhavsriram";
    
    const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1VKV9kIzNWpXArqZXlg6xTK3OgvFiqumf9UCqlna2iJA/edit#gid=0";
    const sheetName = "VAIBHAV S_AIML_TECH";
    const backupSheetName = "Backup_" + sheetName;
    
    const ss = SpreadsheetApp.openByUrl(spreadsheetUrl);
    let mainSheet = ss.getSheetByName(sheetName);
    
    // --- BACKUP & SYNC PHASE ---
    // 1. Ensure Backup Sheet exists
    let backupSheet = ss.getSheetByName(backupSheetName);
    if (!backupSheet) {
      backupSheet = initializeBackupPhoenix(ss, mainSheet, backupSheetName);
    } else {
      // 2. Sync main sheet from backup (restore past data)
      syncFromBackupPhoenix(mainSheet, backupSheet);
    }

    // --- FETCH & UPDATE PHASE ---
    const allSubmissions = getAllTodaySubmissionsPhoenix(leetcodeUsername, codeforcesUsername, atcoderUsername);
    
    // Update both sheets with new submissions
    updateSheetPhoenix(mainSheet, backupSheet, allSubmissions);
    
    // Afterwards, update the dashboard stats with fresh data
    updateDashboardStatsPhoenix(mainSheet, leetcodeUsername, codeforcesUsername, atcoderUsername);
  }

  // --- DATA BACKUP & SYNC ---

  function initializeBackupPhoenix(ss, mainSheet, backupSheetName) {
    Logger.log("Initializing backup sheet...");
    // Duplicate the main sheet to preserve formatting, widths, merged cells entirely
    const backupSheet = mainSheet.copyTo(ss);
    backupSheet.setName(backupSheetName);
    backupSheet.hideSheet(); // Hide it so user doesn't accidentally edit it
    return backupSheet;
  }

  function syncFromBackupPhoenix(mainSheet, backupSheet) {
    Logger.log("Syncing main sheet from backup...");
    const lastBackupRow = backupSheet.getLastRow();
    
    // Clear all rows in main sheet
    const lastMainRow = mainSheet.getLastRow();
    if (lastMainRow >= 1) {
      // Unmerge everything first to avoid partial merge errors
      mainSheet.getRange(1, 1, lastMainRow + 10, mainSheet.getMaxColumns()).breakApart();
      // Clear content and formatting
      mainSheet.getRange(1, 1, lastMainRow + 10, mainSheet.getMaxColumns()).clear();
    }
    
    if (lastBackupRow >= 1) {
      const numRowsToCopy = lastBackupRow;
      const sourceRange = backupSheet.getRange(1, 1, numRowsToCopy, backupSheet.getMaxColumns());
      const targetRange = mainSheet.getRange(1, 1, numRowsToCopy, mainSheet.getMaxColumns());
      
      // Copy exact data, formatting, links
      sourceRange.copyTo(targetRange);
      
      // Copy over merged ranges row by row to be safe
      const merges = sourceRange.getMergedRanges();
      for (let i = 0; i < merges.length; i++) {
        const m = merges[i];
        // Translate backup merge range relative row to main sheet range
        const startRow = m.getRow();
        const startCol = m.getColumn();
        const numRows = m.getNumRows();
        const numCols = m.getNumColumns();
        mainSheet.getRange(startRow, startCol, numRows, numCols).merge();
      }
    }
  }

  // --- AGGREGATOR ---

  function getAllTodaySubmissionsPhoenix(leetcodeUsername, codeforcesUsername, atcoderUsername) {
    let combined = [];
    
    // 1. LeetCode
    try {
      const leetcodeSubs = getLeetCodeSubmissionsPhoenix(leetcodeUsername);
      combined = combined.concat(leetcodeSubs);
    } catch (e) {
      Logger.log("Error fetching LeetCode: " + e.toString());
    }

    // 2. Codeforces
    try {
      const cfSubs = getCodeforcesSubmissionsPhoenix(codeforcesUsername);
      combined = combined.concat(cfSubs);
    } catch (e) {
      Logger.log("Error fetching Codeforces: " + e.toString());
    }

    // 3. AtCoder
    try {
      const atcoderSubs = getAtCoderSubmissionsPhoenix(atcoderUsername);
      combined = combined.concat(atcoderSubs);
    } catch (e) {
      Logger.log("Error fetching AtCoder: " + e.toString());
    }
    
    // Sort by timestamp (Oldest first)
    combined.sort((a, b) => a.timestamp - b.timestamp);
    
    return combined;
  }

  // --- HELPERS ---

  function isTodayPhoenix(timestamp) {
    const date = new Date(timestamp * 1000); // Unix timestamp is in seconds
    const today = new Date();
    
    const dateString = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const todayString = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    return dateString === todayString;
  }

  function getStartOfDayUnixPhoenix() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor(todayStart.getTime() / 1000);
  }

  // --- LEETCODE ---

  function getLeetCodeSubmissionsPhoenix(username) {
    const url = "https://leetcode.com/graphql";
    const query = `
      query recentAcSubmissionList($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          id
          title
          titleSlug
          timestamp
        }
      }
    `;
    
    const variables = { username: username, limit: 20 };
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ query: query, variables: variables }),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    if (json.errors) {
      Logger.log("Error fetching LeetCode submissions: " + JSON.stringify(json.errors));
      return [];
    }
    
    const rawList = json.data.recentAcSubmissionList || [];
    const uniqueSubs = [];
    const seenSlugs = new Set();
    
    // Process newest first
    for (const sub of rawList) {
      if (isTodayPhoenix(parseInt(sub.timestamp))) {
        if (!seenSlugs.has(sub.titleSlug)) {
          seenSlugs.add(sub.titleSlug);
          
          const details = fetchLeetCodeQuestionDetailsPhoenix(sub.titleSlug);
          uniqueSubs.push({
            id: sub.id,
            title: sub.title,
            url: `https://leetcode.com/submissions/detail/${sub.id}/`,
            timestamp: parseInt(sub.timestamp),
            difficulty: details.difficulty,
            platform: "Leetcode",
            topics: details.topics.join(", ")
          });
          Utilities.sleep(500); 
        }
      }
    }
    return uniqueSubs;
  }

  function fetchLeetCodeQuestionDetailsPhoenix(titleSlug) {
    const url = "https://leetcode.com/graphql";
    const query = `
      query questionTitle($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          difficulty
          topicTags { name }
        }
      }
    `;
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ query: query, variables: { titleSlug: titleSlug } }),
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(url, options);
      const json = JSON.parse(response.getContentText());
      if (json.data && json.data.question) {
        return {
          difficulty: json.data.question.difficulty,
          topics: json.data.question.topicTags.map(tag => tag.name)
        };
      }
    } catch (e) {
      Logger.log("Error fetching LC details for " + titleSlug);
    }
    return { difficulty: "Unknown", topics: [] };
  }

  // --- CODEFORCES ---

  function getCodeforcesSubmissionsPhoenix(username) {
    // Fetch up to 50 recent submissions
    const url = `https://codeforces.com/api/user.status?handle=${username}&from=1&count=50`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    let json;
    try {
      json = JSON.parse(response.getContentText());
    } catch (e) {
      throw new Error("Invalid JSON from Codeforces. The API might be down (e.g., Error 502).");
    }
    
    if (json.status !== "OK") {
      Logger.log("Error fetching Codeforces: " + (json.comment || "Unknown error"));
      return [];
    }
    
    const rawList = json.result || [];
    const uniqueSubs = [];
    const seenProblems = new Set(); 
    
    for (const sub of rawList) {
      if (sub.verdict === "OK" && isTodayPhoenix(sub.creationTimeSeconds)) {
        const problemId = sub.problem.contestId + sub.problem.index;
        if (!seenProblems.has(problemId)) {
          seenProblems.add(problemId);
          
          // Map Rating to Difficulty
          let difficulty = "Medium";
          const rating = sub.problem.rating;
          if (rating) {
            if (rating < 1200) difficulty = "Easy";
            else if (rating >= 1600) difficulty = "Hard";
          } else {
              const idx = sub.problem.index.charAt(0);
              if (['A','B'].includes(idx)) difficulty = "Easy";
              else if (['C','D'].includes(idx)) difficulty = "Medium";
              else difficulty = "Hard";
          }
          
          uniqueSubs.push({
            id: sub.id,
            title: `${sub.problem.name} (${sub.problem.index})`,
            url: `https://codeforces.com/contest/${sub.problem.contestId}/submission/${sub.id}`,
            timestamp: sub.creationTimeSeconds,
            difficulty: difficulty,
            platform: "Codeforces Contest", // Updated per user request validation
            topics: (sub.problem.tags || []).join(", ")
          });
        }
      }
    }
    return uniqueSubs;
  }

  // --- ATCODER ---

  function getAtCoderSubmissionsPhoenix(username) {
    const startUnix = getStartOfDayUnixPhoenix();
    const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${username}&from_second=${startUnix}`;
    
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const subs = JSON.parse(response.getContentText()); 
    
    if (!Array.isArray(subs)) {
      Logger.log("Error fetching AtCoder/Kenkoooo: " + JSON.stringify(subs));
      return [];
    }
    
    const validSubs = subs.filter(s => s.result === "AC");
    if (validSubs.length === 0) return [];
    
    const problems = getAtCoderProblemModelsPhoenix();
    const uniqueSubs = [];
    const seenProblems = new Set();
    
    validSubs.reverse(); // Newest first

    for (const sub of validSubs) {
      if (!seenProblems.has(sub.problem_id)) {
        seenProblems.add(sub.problem_id);
        
        let difficulty = "Easy";
        let diffVal = 0;
        if (problems[sub.problem_id] && problems[sub.problem_id].difficulty !== undefined) {
            diffVal = problems[sub.problem_id].difficulty;
        }
        
        if (diffVal < 800) difficulty = "Easy";
        else if (diffVal < 1200) difficulty = "Medium";
        else difficulty = "Hard";
        
        uniqueSubs.push({
          id: sub.id,
          title: sub.problem_id, 
          url: `https://atcoder.jp/contests/${sub.contest_id}/submissions/${sub.id}`,
          timestamp: sub.epoch_second,
          difficulty: difficulty,
          platform: "Atcoder", 
          topics: "" 
        });
      }
    }
    
    const problemTitles = getAtCoderProblemTitlesPhoenix();
    uniqueSubs.forEach(s => {
      if (problemTitles[s.title]) {
        s.title = problemTitles[s.title].title; 
      }
    });

    return uniqueSubs;
  }

  function getAtCoderProblemModelsPhoenix() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get("atcoder_models");
    if (cached) return JSON.parse(cached);
    
    try {
      const url = "https://kenkoooo.com/atcoder/resources/problem-models.json";
      const res = UrlFetchApp.fetch(url);
      const data = res.getContentText();
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }

  function getAtCoderProblemTitlesPhoenix() {
    try {
      const url = "https://kenkoooo.com/atcoder/resources/problems.json";
      const res = UrlFetchApp.fetch(url);
      const list = JSON.parse(res.getContentText());
      const map = {};
      list.forEach(p => {
        map[p.id] = p;
      });
      return map;
    } catch (e) {
      return {};
    }
  }


  // --- SHEET UPDATER ---

  function updateSheetPhoenix(mainSheet, backupSheet, submissions) {
    if (!mainSheet || !backupSheet) {
      Logger.log("Main or Backup sheet not found.");
      return;
    }
    
    const lastRow = mainSheet.getLastRow();
    
    // 1. Process New Submissions if any
    if (submissions.length > 0) {
      const date = new Date();
      const formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), "dd.MM.yyyy");
      let startRow = lastRow + 1;
      let existingCount = 0;
      let isTodayEntry = false;
      let dateMergeRange = null;
      
      /* DEDUPLICATION */
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const formattedYesterday = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), "dd.MM.yyyy");
      
      const yesterdayTitles = new Set();
      const existingTitles = new Map(); // Changed to Map to store title -> row number

      if (lastRow > 0) {
        // Need RichTextValues to check existing links
        const dataRange = mainSheet.getRange(1, 1, lastRow, 2);
        const dataValues = dataRange.getValues();
        const richTextValues = mainSheet.getRange(1, 2, lastRow, 1).getRichTextValues(); // Fetch links from Col B
        
        let currentDateStr = "";

        for (let i = 0; i < lastRow; i++) {
          let dateCellVal = dataValues[i][0];
          if (dateCellVal !== "") {
              if (dateCellVal instanceof Date) {
                currentDateStr = Utilities.formatDate(dateCellVal, Session.getScriptTimeZone(), "dd.MM.yyyy");
              } else {
                currentDateStr = String(dateCellVal);
              }
          }
          
          const title = dataValues[i][1] ? dataValues[i][1].toString() : "";
          
          if (currentDateStr === formattedYesterday) {
              if (title) yesterdayTitles.add(title);
          }
          if (currentDateStr === formattedDate) {
              if (title) {
                // Store row number and existing URL
                const existingUrl = richTextValues[i][0].getLinkUrl();
                existingTitles.set(title, { row: i + 1, url: existingUrl }); 
              }
              isTodayEntry = true;
          }
        }
      }
      
      if (isTodayEntry) {
        const dateCell = mainSheet.getRange(lastRow, 1);
        const merged = dateCell.getMergedRanges();
        if (merged.length > 0) {
          dateMergeRange = merged[0];
          // Safe way: Read from the top row of the merge
          const topRow = dateMergeRange.getRow();
          const countCell = mainSheet.getRange(topRow, 7); 
          existingCount = parseInt(countCell.getValue()) || 0;
        } else {
          const countCell = mainSheet.getRange(lastRow, 7);
          existingCount = parseInt(countCell.getValue()) || 0;
        }
      }

      // 1. Process Updates or Additions
      const submissionsToAdd = [];
      
      for (const sub of submissions) {
        if (yesterdayTitles.has(sub.title)) {
          continue;
        }
        
        if (existingTitles.has(sub.title)) {
          // Check if link is different
          const existingData = existingTitles.get(sub.title);
          if (existingData.url !== sub.url) {
            const rowToUpdate = existingData.row;
            const richText = SpreadsheetApp.newRichTextValue()
              .setText(sub.title)
              .setLinkUrl(sub.url)
              .build();
            mainSheet.getRange(rowToUpdate, 2).setRichTextValue(richText);
            backupSheet.getRange(rowToUpdate, 2).setRichTextValue(richText);
            Logger.log(`Updated link for existing submission: ${sub.title} at row ${rowToUpdate}`);
          } else {
            Logger.log(`Skipping update for ${sub.title}, link already current.`);
          }
        } else {
          // Prepare to add new row
          submissionsToAdd.push(sub);
        }
      }
      
      const numNew = submissionsToAdd.length;
      
      if (numNew > 0) {
        // Logic for adding new rows...
        // Calculate start row based on merging logic.
        // If we are adding to existing block, startRow is lastRow + 1.
        const writeStartRow = lastRow + 1; 

        for (let i = 0; i < numNew; i++) {
          const sub = submissionsToAdd[i];
          const currentRow = writeStartRow + i;
          
          const richText = SpreadsheetApp.newRichTextValue()
            .setText(sub.title)
            .setLinkUrl(sub.url)
            .build();
          
          // Write to Main Sheet
          mainSheet.getRange(currentRow, 2).setRichTextValue(richText);
          mainSheet.getRange(currentRow, 4).setValue(sub.difficulty);
          mainSheet.getRange(currentRow, 5).setValue(sub.platform);
          mainSheet.getRange(currentRow, 6).setValue(sub.topics);
          
          // Write to Backup Sheet
          backupSheet.getRange(currentRow, 2).setRichTextValue(richText);
          backupSheet.getRange(currentRow, 4).setValue(sub.difficulty);
          backupSheet.getRange(currentRow, 5).setValue(sub.platform);
          backupSheet.getRange(currentRow, 6).setValue(sub.topics);
        }
        
        let finalMergeStartRow = writeStartRow;
        let finalMergeEndRow = writeStartRow + numNew - 1;

        // ... Merging logic for today
        // Correct existingCount based on whether we added rows to an existing block or created a new one.
        const totalCount = existingCount + numNew;
        
        if (isTodayEntry) {
          if (dateMergeRange) {
            finalMergeStartRow = dateMergeRange.getRow();
          } else {
            let r = lastRow;
            // If existingCount > 0 and no merge, it was likely single row.
            // Scan up to verify start of today
            while (r > 0) {
                const val = mainSheet.getRange(r, 1).getValue();
                let dStr = "";
                if (val instanceof Date) dStr = Utilities.formatDate(val, Session.getScriptTimeZone(), "dd.MM.yyyy");
                else if (val) dStr = String(val);
                
                if (val !== "" && dStr !== formattedDate) {
                  break;
                }
                if (val !== "" && dStr === formattedDate) {
                  finalMergeStartRow = r;
                }
                r--;
            }
            if (!dateMergeRange && existingCount > 0) {
                // If scan failed or logic simplistic, fallback to known start logic if single row
                // But loop above is safer.
            }
          }
        } 

        const totalNumRows = finalMergeEndRow - finalMergeStartRow + 1;
        
        // Merge Date Column
        const finalDateRange = mainSheet.getRange(finalMergeStartRow, 1, totalNumRows, 1);
        finalDateRange.merge().setValue(formattedDate).setVerticalAlignment("middle").setHorizontalAlignment("center");
        finalDateRange.setBorder(true, true, true, true, null, null);
        
        const backupDateRange = backupSheet.getRange(finalMergeStartRow, 1, totalNumRows, 1);
        backupDateRange.merge().setValue(formattedDate).setVerticalAlignment("middle").setHorizontalAlignment("center");
        backupDateRange.setBorder(true, true, true, true, null, null);

        // Merge Count Column
        const finalCountRange = mainSheet.getRange(finalMergeStartRow, 7, totalNumRows, 1);
        finalCountRange.merge().setValue(totalCount).setVerticalAlignment("middle").setHorizontalAlignment("center");
        finalCountRange.setBorder(true, true, true, true, null, null); 
        
        const backupCountRange = backupSheet.getRange(finalMergeStartRow, 7, totalNumRows, 1);
        backupCountRange.merge().setValue(totalCount).setVerticalAlignment("middle").setHorizontalAlignment("center");
        backupCountRange.setBorder(true, true, true, true, null, null);

        Logger.log(`Added ${numNew} new submissions in main and backup sheets. Total for today: ${totalCount}`);
      } else {
        Logger.log("No new unique submissions to add.");
      }
    }
  }

  // --- DASHBOARD UPDATER ---

  function updateDashboardStatsPhoenix(sheet, leetcodeUsername, codeforcesUsername, atcoderUsername) {
    // 1. Fetch Stats from APIs
    const leetCodeStats = fetchLeetCodeTotalStatsPhoenix(leetcodeUsername);
    const codeforcesTotal = fetchCodeforcesTotalSolvedPhoenix(codeforcesUsername);
    const atcoderTotal = fetchAtCoderTotalSolvedPhoenix(atcoderUsername);
    
    // 2. Count Difficulty for Codeforces & AtCoder FROM SHEET (as requested)
    // Scan filtering by Platform and Difficulty
    const sheetStats = getSheetDifficultyCountsPhoenix(sheet);
    
    // 3. Aggregate
    // E4:E6 (Platform Counts - from API)
    // E4 (LeetCode)
    sheet.getRange("E4").setValue(leetCodeStats.all);
    // E5 (AtCoder)
    sheet.getRange("E5").setValue(atcoderTotal);
    // E6 (Codeforces)
    sheet.getRange("E6").setValue(codeforcesTotal);
    
    // I4:I6 (Difficulty Counts - Hybrid)
    // I4 (Hard) = LC(Hard) + AC(Hard from Sheet) + CF(Hard from Sheet)
    const totalHard = leetCodeStats.hard + sheetStats.atcoder.hard + sheetStats.codeforces.hard;
    sheet.getRange("I4").setValue(totalHard);
    
    // I5 (Medium)
    const totalMedium = leetCodeStats.medium + sheetStats.atcoder.medium + sheetStats.codeforces.medium;
    sheet.getRange("I5").setValue(totalMedium);
    
    // I6 (Easy)
    const totalEasy = leetCodeStats.easy + sheetStats.atcoder.easy + sheetStats.codeforces.easy;
    sheet.getRange("I6").setValue(totalEasy);
    
    Logger.log(`Dashboard Updated. LC: ${leetCodeStats.all}, AC: ${atcoderTotal}, CF: ${codeforcesTotal}`);
  }

  function fetchLeetCodeTotalStatsPhoenix(username) {
    const url = "https://leetcode.com/graphql";
    const query = `
      query userProblemsSolved($username: String!) {
        matchedUser(username: $username) {
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ query: query, variables: { username: username } }),
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(url, options);
      const json = JSON.parse(response.getContentText());
      
      if (json.data && json.data.matchedUser) {
        const stats = json.data.matchedUser.submitStats.acSubmissionNum;
        let all = 0, easy = 0, medium = 0, hard = 0;
        stats.forEach(s => {
          if (s.difficulty === "All") all = s.count;
          if (s.difficulty === "Easy") easy = s.count;
          if (s.difficulty === "Medium") medium = s.count;
          if (s.difficulty === "Hard") hard = s.count;
        });
        return { all, easy, medium, hard };
      }
    } catch (e) {
      Logger.log("Error fetching LC Stats: " + e.toString());
    }
    return { all: 0, easy: 0, medium: 0, hard: 0 };
  }

  function fetchCodeforcesTotalSolvedPhoenix(username) {
    // Use user.status to count unique AC
    try {
      // Limit to 5000? Should be enough for recent. If user has more, might need pagination?
      // Let's assume < 10000 for now. Using count=10000.
      const url = `https://codeforces.com/api/user.status?handle=${username}&from=1&count=5000`;
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      
      let json;
      try {
        json = JSON.parse(response.getContentText());
      } catch (e) {
        throw new Error("Invalid JSON from Codeforces. The API might be down (e.g., Error 502).");
      }
      if (json.status === "OK") {
        const solved = new Set();
        json.result.forEach(sub => {
          if (sub.verdict === "OK") {
              const id = sub.problem.contestId + sub.problem.index;
              solved.add(id);
          }
        });
        return solved.size;
      }
    } catch (e) {
      Logger.log("Error fetching CF Stats: " + e.toString());
    }
    return 0;
  }

  function fetchAtCoderTotalSolvedPhoenix(username) {
    try {
      const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${username}`;
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const json = JSON.parse(response.getContentText());
      // json = { count: 123, rank: 456 }
      if (json.count !== undefined) {
          return json.count;
      }
    } catch (e) {
      Logger.log("Error fetching AC Stats: " + e.toString());
    }
    return 0;
  }

  function getSheetDifficultyCountsPhoenix(sheet) {
    const lastRow = sheet.getLastRow();
    const stats = {
      atcoder: { easy: 0, medium: 0, hard: 0 },
      codeforces: { easy: 0, medium: 0, hard: 0 }
    };
    
    if (lastRow < 7) return stats; // Header check
    
    // Data starts row 7
    const startRow = 7;
    const numRows = lastRow - startRow + 1;
    const diffs = sheet.getRange(startRow, 4, numRows, 1).getValues();
    const plats = sheet.getRange(startRow, 5, numRows, 1).getValues(); // Platform Col is E (5)
    
    for (let i = 0; i < numRows; i++) {
      const diff = String(diffs[i][0]).trim();
      const plat = String(plats[i][0]).trim();
      
      if (plat === "Atcoder") {
        if (diff === "Easy") stats.atcoder.easy++;
        else if (diff === "Medium") stats.atcoder.medium++;
        else if (diff === "Hard") stats.atcoder.hard++;
      } else if (plat.includes("Codeforces")) {
        if (diff === "Easy") stats.codeforces.easy++;
        else if (diff === "Medium") stats.codeforces.medium++;
        else if (diff === "Hard") stats.codeforces.hard++;
      }
    }
    return stats;
  }