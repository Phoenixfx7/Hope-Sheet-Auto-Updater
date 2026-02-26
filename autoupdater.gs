/**
 * Main entry point for the CP Tracker Library 
 * @param {Object} config - The configuration object
 * @param {string} config.sheetName - The student's Tab Name
 * @param {string} config.leetcode - The student's LeetCode username
 * @param {string} config.codeforces - The student's Codeforces username
 * @param {string} config.atcoder - The student's AtCoder username
 * @param {string} config.masterSheetId - The Spreadsheet App ID of the master workbook
 */
function runSync(config) {
  const { sheetName, leetcode, codeforces, atcoder, masterSheetId } = config;

  if (!masterSheetId || !sheetName) {
    Logger.log("Missing masterSheetId or sheetName in config.");
    return;
  }
  
  let ss;
  try {
    ss = SpreadsheetApp.openById(masterSheetId);
  } catch (e) {
    Logger.log("Could not open Spreadsheet by ID. Check permissions: " + e.toString());
    return;
  }

  const mainSheet = ss.getSheetByName(sheetName);
  
  if (!mainSheet) {
    Logger.log(`Main sheet '${sheetName}' not found.`);
    return;
  }
  
  const backupSheetName = "Backup_" + sheetName;
  let backupSheet = ss.getSheetByName(backupSheetName);
  
  if (!backupSheet) {
    backupSheet = initializeBackupPhoenix(ss, mainSheet, backupSheetName);
  } else {
    // If user unhid the sheet manually, re-hide it automatically
    if (!backupSheet.isSheetHidden()) {
      backupSheet.hideSheet();
    }
    syncFromBackupPhoenix(mainSheet, backupSheet);
  }

  const allSubmissions = getAllTodaySubmissionsPhoenix(leetcode, codeforces, atcoder);
  
  updateSheetPhoenix(mainSheet, backupSheet, allSubmissions);
  
  updateDashboardStatsPhoenix(mainSheet, leetcode, codeforces, atcoder);
}

function initializeBackupPhoenix(ss, mainSheet, backupSheetName) {
  Logger.log("Initializing backup sheet...");
  const backupSheet = mainSheet.copyTo(ss);
  backupSheet.setName(backupSheetName);
  backupSheet.hideSheet(); 
  
  // Protect the sheet: only the user who runs the script and staff owners can edit it
  try {
    const protection = backupSheet.protect().setDescription('Backup Protection');
    const editors = protection.getEditors();
    protection.removeEditors(editors);
  } catch(e) {
    Logger.log("Could not apply protection to backup sheet. User might not have permission to change protections: " + e.toString());
  }

  return backupSheet;
}

function syncFromBackupPhoenix(mainSheet, backupSheet) {
  Logger.log("Syncing main sheet from backup...");
  const lastBackupRow = backupSheet.getLastRow();
  
  const lastMainRow = mainSheet.getLastRow();
  if (lastMainRow >= 1) {
    mainSheet.getRange(1, 1, lastMainRow + 10, mainSheet.getMaxColumns()).breakApart();
    mainSheet.getRange(1, 1, lastMainRow + 10, mainSheet.getMaxColumns()).clear();
  }
  
  if (lastBackupRow >= 1) {
    const numRowsToCopy = lastBackupRow;
    const sourceRange = backupSheet.getRange(1, 1, numRowsToCopy, backupSheet.getMaxColumns());
    const targetRange = mainSheet.getRange(1, 1, numRowsToCopy, mainSheet.getMaxColumns());
    
    sourceRange.copyTo(targetRange);
    
    const merges = sourceRange.getMergedRanges();
    for (let i = 0; i < merges.length; i++) {
      const m = merges[i];
      const startRow = m.getRow();
      const startCol = m.getColumn();
      const numRows = m.getNumRows();
      const numCols = m.getNumColumns();
      mainSheet.getRange(startRow, startCol, numRows, numCols).merge();
    }
  }
}

function getAllTodaySubmissionsPhoenix(leetcodeUsername, codeforcesUsername, atcoderUsername) {
  let combined = [];
  
  try {
    const leetcodeSubs = getLeetCodeSubmissionsPhoenix(leetcodeUsername);
    combined = combined.concat(leetcodeSubs);
  } catch (e) {
    Logger.log("Error fetching LeetCode: " + e.toString());
  }

  try {
    const cfSubs = getCodeforcesSubmissionsPhoenix(codeforcesUsername);
    combined = combined.concat(cfSubs);
  } catch (e) {
    Logger.log("Error fetching Codeforces: " + e.toString());
  }

  try {
    const atcoderSubs = getAtCoderSubmissionsPhoenix(atcoderUsername);
    combined = combined.concat(atcoderSubs);
  } catch (e) {
    Logger.log("Error fetching AtCoder: " + e.toString());
  }
  
  combined.sort((a, b) => a.timestamp - b.timestamp);
  
  return combined;
}

function isTodayPhoenix(timestamp) {
  const date = new Date(timestamp * 1000); 
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

function getCodeforcesSubmissionsPhoenix(username) {
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
          platform: "Codeforces Contest", 
          topics: (sub.problem.tags || []).join(", ")
        });
      }
    }
  }
  return uniqueSubs;
}

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
  
  validSubs.reverse(); 

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

function updateSheetPhoenix(mainSheet, backupSheet, submissions) {
  if (!mainSheet || !backupSheet) {
    Logger.log("Main or Backup sheet not found.");
    return;
  }
  
  const lastRow = mainSheet.getLastRow();
  
  if (submissions.length > 0) {
    const date = new Date();
    const formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), "dd.MM.yyyy");
    let startRow = lastRow + 1;
    let existingCount = 0;
    let isTodayEntry = false;
    let dateMergeRange = null;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedYesterday = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), "dd.MM.yyyy");
    
    const yesterdayTitles = new Set();
    const existingTitles = new Map(); 

    if (lastRow > 0) {
      const dataRange = mainSheet.getRange(1, 1, lastRow, 2);
      const dataValues = dataRange.getValues();
      const richTextValues = mainSheet.getRange(1, 2, lastRow, 1).getRichTextValues(); 
      
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
        const topRow = dateMergeRange.getRow();
        const countCell = mainSheet.getRange(topRow, 7); 
        existingCount = parseInt(countCell.getValue()) || 0;
      } else {
        const countCell = mainSheet.getRange(lastRow, 7);
        existingCount = parseInt(countCell.getValue()) || 0;
      }
    }

    const submissionsToAdd = [];
    
    for (const sub of submissions) {
      if (yesterdayTitles.has(sub.title)) {
        continue;
      }
      
      if (existingTitles.has(sub.title)) {
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
        submissionsToAdd.push(sub);
      }
    }
    
    const numNew = submissionsToAdd.length;
    
    if (numNew > 0) {
      const writeStartRow = lastRow + 1; 
      const templateDiff = mainSheet.getRange(14, 4);
      const templatePlatform = mainSheet.getRange(14, 5);

      for (let i = 0; i < numNew; i++) {
        const sub = submissionsToAdd[i];
        const currentRow = writeStartRow + i;
        
        const richText = SpreadsheetApp.newRichTextValue()
          .setText(sub.title)
          .setLinkUrl(sub.url)
          .build();
        
        mainSheet.getRange(currentRow, 2).setRichTextValue(richText);
        // Merge Columns B and C, and center align
        mainSheet.getRange(currentRow, 2, 1, 2).mergeAcross().setHorizontalAlignment("center");
        
        const targetDiff = mainSheet.getRange(currentRow, 4);
        templateDiff.copyTo(targetDiff, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
        targetDiff.setValue(sub.difficulty);
        
        const targetPlatform = mainSheet.getRange(currentRow, 5);
        templatePlatform.copyTo(targetPlatform, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
        targetPlatform.setValue(sub.platform);
        
        mainSheet.getRange(currentRow, 6).setValue(sub.topics);
        
        backupSheet.getRange(currentRow, 2).setRichTextValue(richText);
        backupSheet.getRange(currentRow, 2, 1, 2).mergeAcross().setHorizontalAlignment("center");
        
        const bTargetDiff = backupSheet.getRange(currentRow, 4);
        templateDiff.copyTo(bTargetDiff, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
        bTargetDiff.setValue(sub.difficulty);
        
        const bTargetPlatform = backupSheet.getRange(currentRow, 5);
        templatePlatform.copyTo(bTargetPlatform, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
        bTargetPlatform.setValue(sub.platform);
        
        backupSheet.getRange(currentRow, 6).setValue(sub.topics);
      }
      
      // Add borders to the inserted Problem Data block (Cols B through F)
      mainSheet.getRange(writeStartRow, 2, numNew, 5).setBorder(true, true, true, true, true, true);
      backupSheet.getRange(writeStartRow, 2, numNew, 5).setBorder(true, true, true, true, true, true);
      
      let finalMergeStartRow = writeStartRow;
      let finalMergeEndRow = writeStartRow + numNew - 1;

      const totalCount = existingCount + numNew;
      
      if (isTodayEntry) {
        if (dateMergeRange) {
          finalMergeStartRow = dateMergeRange.getRow();
        } else {
          let r = lastRow;
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
        }
      } 

      const totalNumRows = finalMergeEndRow - finalMergeStartRow + 1;
      
      const finalDateRange = mainSheet.getRange(finalMergeStartRow, 1, totalNumRows, 1);
      finalDateRange.merge().setValue(formattedDate).setVerticalAlignment("middle").setHorizontalAlignment("center");
      finalDateRange.setBorder(true, true, true, true, null, null);
      
      const backupDateRange = backupSheet.getRange(finalMergeStartRow, 1, totalNumRows, 1);
      backupDateRange.merge().setValue(formattedDate).setVerticalAlignment("middle").setHorizontalAlignment("center");
      backupDateRange.setBorder(true, true, true, true, null, null);

      const finalCountRange = mainSheet.getRange(finalMergeStartRow, 7, totalNumRows, 1);
      finalCountRange.merge().setValue(totalCount).setFontWeight("bold").setVerticalAlignment("middle").setHorizontalAlignment("center");
      finalCountRange.setBorder(true, true, true, true, null, null); 
      
      const backupCountRange = backupSheet.getRange(finalMergeStartRow, 7, totalNumRows, 1);
      backupCountRange.merge().setValue(totalCount).setFontWeight("bold").setVerticalAlignment("middle").setHorizontalAlignment("center");
      backupCountRange.setBorder(true, true, true, true, null, null);

      Logger.log(`Added ${numNew} new submissions in main and backup sheets. Total for today: ${totalCount}`);
    } else {
      Logger.log("No new unique submissions to add.");
    }
  }
}

function updateDashboardStatsPhoenix(sheet, leetcodeUsername, codeforcesUsername, atcoderUsername) {
  const leetCodeStats = fetchLeetCodeTotalStatsPhoenix(leetcodeUsername);
  const codeforcesTotal = fetchCodeforcesTotalSolvedPhoenix(codeforcesUsername);
  const atcoderTotal = fetchAtCoderTotalSolvedPhoenix(atcoderUsername);
  
  const leetCodeRating = fetchLeetCodeRatingPhoenix(leetcodeUsername);
  const codeforcesRating = fetchCodeforcesRatingPhoenix(codeforcesUsername);
  const atcoderRating = fetchAtCoderRatingPhoenix(atcoderUsername);
  
  const sheetStats = getSheetDifficultyCountsPhoenix(sheet);
  
  sheet.getRange("E4").setValue(leetCodeStats.all);
  sheet.getRange("E5").setValue(atcoderTotal);
  sheet.getRange("E6").setValue(codeforcesTotal);
  
  // Set Ratings in F4:F6
  sheet.getRange("F4").setValue(leetCodeRating);
  sheet.getRange("F5").setValue(atcoderRating);
  sheet.getRange("F6").setValue(codeforcesRating);
  
  const totalHard = leetCodeStats.hard + sheetStats.atcoder.hard + sheetStats.codeforces.hard;
  sheet.getRange("I4").setValue(totalHard);
  
  const totalMedium = leetCodeStats.medium + sheetStats.atcoder.medium + sheetStats.codeforces.medium;
  sheet.getRange("I5").setValue(totalMedium);
  
  const totalEasy = leetCodeStats.easy + sheetStats.atcoder.easy + sheetStats.codeforces.easy;
  sheet.getRange("I6").setValue(totalEasy);
  
  Logger.log(`Dashboard Updated. LC: ${leetCodeStats.all} (Rating: ${leetCodeRating}), AC: ${atcoderTotal} (Rating: ${atcoderRating}), CF: ${codeforcesTotal} (Rating: ${codeforcesRating})`);
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

function fetchLeetCodeRatingPhoenix(username) {
  const url = "https://leetcode.com/graphql";
  const query = `
    query userContestRankingInfo($username: String!) {
      userContestRanking(username: $username) {
        rating
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
    if (json.data && json.data.userContestRanking && json.data.userContestRanking.rating) {
      return Math.round(json.data.userContestRanking.rating);
    }
  } catch (e) {
    Logger.log("Error fetching LC Rating: " + e.toString());
  }
  return "N/A";
}

function fetchCodeforcesTotalSolvedPhoenix(username) {
  try {
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

function fetchCodeforcesRatingPhoenix(username) {
  try {
    const url = `https://codeforces.com/api/user.info?handles=${username}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    let json;
    try {
      json = JSON.parse(response.getContentText());
    } catch (e) {
      return "N/A";
    }
    
    if (json.status === "OK" && json.result && json.result.length > 0) {
      return json.result[0].rating || "Unrated";
    }
  } catch (e) {
    Logger.log("Error fetching CF Rating: " + e.toString());
  }
  return "N/A";
}

function fetchAtCoderTotalSolvedPhoenix(username) {
  try {
    const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${username}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(response.getContentText());
    if (json.count !== undefined) {
        return json.count;
    }
  } catch (e) {
    Logger.log("Error fetching AC Stats: " + e.toString());
  }
  return 0;
}

function fetchAtCoderRatingPhoenix(username) {
  try {
    const url = `https://atcoder.jp/users/${username}/history/json`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (response.getResponseCode() === 200) {
      const history = JSON.parse(response.getContentText());
      if (Array.isArray(history) && history.length > 0) {
        const latest = history[history.length - 1];
        if (latest && latest.NewRating !== undefined) {
           return latest.NewRating;
        }
      }
      return "Unrated";
    }
  } catch (e) {
    Logger.log("Error fetching AC Rating: " + e.toString());
  }
  return "N/A";
}

function getSheetDifficultyCountsPhoenix(sheet) {
  const lastRow = sheet.getLastRow();
  const stats = {
    atcoder: { easy: 0, medium: 0, hard: 0 },
    codeforces: { easy: 0, medium: 0, hard: 0 }
  };
  
  if (lastRow < 7) return stats; 
  
  const startRow = 7;
  const numRows = lastRow - startRow + 1;
  const diffs = sheet.getRange(startRow, 4, numRows, 1).getValues();
  const plats = sheet.getRange(startRow, 5, numRows, 1).getValues(); 
  
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