// ============================================================
// PROJECT ADAM — NAUKRI QUESTION COLLECTOR v0.1
//
// PURPOSE
// -------
// 1. Open Naukri Recommended Jobs
// 2. Harvest job URLs
// 3. Open each job
// 4. Click Apply
// 5. Capture questionnaire JSON from network responses
// 6. Extract + deduplicate questions
// 7. Store everything in SQLite
//
// IMPORTANT
// ---------
// This collector DOES NOT answer recruiter questions.
// It blocks /myapply/saveApply as a safety guard.
//
// INSTALL
// -------
// npm install playwright better-sqlite3
// npx playwright install chromium
//
// TEST
// ----
// MAX_JOBS=5 RUN_HOURS=1 node collector.js
//
// LONG RUN
// --------
// RUN_HOURS=12 node collector.js
// ============================================================


const { chromium } = require("playwright");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");


// ============================================================
// CONFIG
// ============================================================

const CONFIG = {

  START_URL:
    process.env.START_URL ||
    "https://www.naukri.com/mnjuser/recommendedjobs",

  RUN_HOURS:
    Number(process.env.RUN_HOURS || 12),

  MAX_JOBS:
    Number(process.env.MAX_JOBS || 5000),

  HEADLESS:
    process.env.HEADLESS === "1",

  DB_PATH:
    path.resolve(
      process.env.DB_PATH ||
      "./data/adam_questions.db"
    ),

  PROFILE_DIR:
    path.resolve(
      process.env.PROFILE_DIR ||
      "./browser-profile"
    ),

  LOG_DIR:
    path.resolve("./logs"),

  QUESTION_WAIT_MS:
    Number(
      process.env.QUESTION_WAIT_MS ||
      12000
    ),

  JOB_GAP_MS:
    Number(
      process.env.JOB_GAP_MS ||
      1500
    ),

  CYCLE_WAIT_MINUTES:
    Number(
      process.env.CYCLE_WAIT_MINUTES ||
      10
    ),

  HARVEST_SCROLL_PASSES:
    Number(
      process.env.HARVEST_SCROLL_PASSES ||
      50
    )
};


// ============================================================
// DIRECTORIES
// ============================================================

fs.mkdirSync(
  path.dirname(CONFIG.DB_PATH),
  { recursive: true }
);

fs.mkdirSync(
  CONFIG.PROFILE_DIR,
  { recursive: true }
);

fs.mkdirSync(
  CONFIG.LOG_DIR,
  { recursive: true }
);


// ============================================================
// HELPERS
// ============================================================

const sleep = ms =>
  new Promise(resolve =>
    setTimeout(resolve, ms)
  );


function timestamp() {
  return new Date().toISOString();
}


function log(...args) {

  const line =
    `[${timestamp()}] ${args.join(" ")}`;

  console.log(line);

  try {

    fs.appendFileSync(
      path.join(
        CONFIG.LOG_DIR,
        "collector.log"
      ),
      line + "\n"
    );

  }
  catch {}

}


function clean(text) {

  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();

}


function normalizeQuestion(text) {

  return clean(text)
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(
      /[^a-z0-9.+%\- ]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

}


function questionKey(
  questionText,
  questionType
) {

  const raw =
    `${normalizeQuestion(questionText)}|${clean(questionType).toLowerCase()}`;

  return crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex")
    .slice(0, 24);

}


function extractJobId(url) {

  try {

    const pathname =
      new URL(url).pathname;

    const match =
      pathname.match(
        /-(\d{10,})\/?$/
      );

    return match
      ? match[1]
      : null;

  }
  catch {

    return null;

  }

}


function waitForEnter(
  message
) {

  return new Promise(resolve => {

    const rl =
      readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

    rl.question(
      message,
      () => {

        rl.close();
        resolve();

      }
    );

  });

}


// ============================================================
// DATABASE
// ============================================================

const db =
  new Database(
    CONFIG.DB_PATH
  );


db.pragma(
  "journal_mode = WAL"
);

db.pragma(
  "foreign_keys = ON"
);

db.pragma(
  "busy_timeout = 5000"
);


// ============================================================
// DATABASE SCHEMA
// ============================================================

db.exec(`

CREATE TABLE IF NOT EXISTS collector_runs (

    run_id INTEGER PRIMARY KEY AUTOINCREMENT,

    started_at TEXT NOT NULL,

    ended_at TEXT,

    jobs_harvested INTEGER DEFAULT 0,

    jobs_processed INTEGER DEFAULT 0,

    questionnaire_jobs INTEGER DEFAULT 0,

    total_question_occurrences INTEGER DEFAULT 0,

    unique_questions_added INTEGER DEFAULT 0,

    notes TEXT

);


CREATE TABLE IF NOT EXISTS jobs (

    job_id TEXT PRIMARY KEY,

    job_url TEXT,

    job_title TEXT,

    company_name TEXT,

    is_custom INTEGER,

    first_seen_at TEXT NOT NULL,

    last_seen_at TEXT NOT NULL,

    seen_count INTEGER NOT NULL DEFAULT 1

);


CREATE TABLE IF NOT EXISTS questions (

    question_key TEXT PRIMARY KEY,

    representative_text TEXT NOT NULL,

    normalized_text TEXT NOT NULL,

    question_type TEXT,

    category TEXT,

    canonical_intent TEXT,

    mandatory INTEGER,

    default_options_json TEXT,

    answer_options_metadata_json TEXT,

    first_seen_at TEXT NOT NULL,

    last_seen_at TEXT NOT NULL,

    seen_count INTEGER NOT NULL DEFAULT 0

);


CREATE INDEX IF NOT EXISTS idx_questions_normalized
ON questions(normalized_text);


CREATE INDEX IF NOT EXISTS idx_questions_type
ON questions(question_type);


CREATE INDEX IF NOT EXISTS idx_questions_category
ON questions(category);


CREATE INDEX IF NOT EXISTS idx_questions_seen
ON questions(seen_count);


CREATE TABLE IF NOT EXISTS question_occurrences (

    occurrence_id INTEGER PRIMARY KEY AUTOINCREMENT,

    job_id TEXT NOT NULL,

    question_key TEXT NOT NULL,

    source_question_id TEXT,

    questionnaire_id TEXT,

    questionnaire_type TEXT,

    question_text TEXT,

    question_type TEXT,

    category TEXT,

    mandatory INTEGER,

    prefill_json TEXT,

    options_json TEXT,

    answer_options_metadata_json TEXT,

    skippable INTEGER DEFAULT 0,

    captured_at TEXT NOT NULL,

    raw_question_json TEXT,

    UNIQUE(
      job_id,
      question_key,
      source_question_id
    )

);


CREATE INDEX IF NOT EXISTS idx_occurrence_job
ON question_occurrences(job_id);


CREATE INDEX IF NOT EXISTS idx_occurrence_question
ON question_occurrences(question_key);


CREATE TABLE IF NOT EXISTS user_prefills (

    job_id TEXT NOT NULL,

    source_question_id TEXT NOT NULL,

    value_json TEXT,

    captured_at TEXT NOT NULL,

    PRIMARY KEY(
      job_id,
      source_question_id
    )

);


CREATE TABLE IF NOT EXISTS api_captures (

    capture_id INTEGER PRIMARY KEY AUTOINCREMENT,

    job_id TEXT,

    response_url TEXT,

    captured_at TEXT NOT NULL,

    apply_redirect_url TEXT,

    flow_type TEXT,

    current_conversation_name TEXT,

    current_node_name TEXT,

    current_node INTEGER,

    raw_json TEXT NOT NULL

);


CREATE TABLE IF NOT EXISTS processed_jobs (

    job_id TEXT PRIMARY KEY,

    job_url TEXT,

    status TEXT NOT NULL,

    attempt_count INTEGER NOT NULL DEFAULT 1,

    first_attempt_at TEXT NOT NULL,

    last_attempt_at TEXT NOT NULL,

    last_error TEXT

);

`);


// ============================================================
// PREPARED DB STATEMENTS
// ============================================================

const stmts = {};


stmts.getProcessed =
  db.prepare(`

    SELECT *
    FROM processed_jobs
    WHERE job_id = ?

  `);


stmts.upsertProcessed =
  db.prepare(`

    INSERT INTO processed_jobs (

      job_id,
      job_url,
      status,
      attempt_count,
      first_attempt_at,
      last_attempt_at,
      last_error

    )

    VALUES (?, ?, ?, 1, ?, ?, ?)

    ON CONFLICT(job_id)

    DO UPDATE SET

      job_url =
        excluded.job_url,

      status =
        excluded.status,

      attempt_count =
        processed_jobs.attempt_count + 1,

      last_attempt_at =
        excluded.last_attempt_at,

      last_error =
        excluded.last_error

  `);


stmts.upsertJob =
  db.prepare(`

    INSERT INTO jobs (

      job_id,
      job_url,
      job_title,
      company_name,
      is_custom,
      first_seen_at,
      last_seen_at,
      seen_count

    )

    VALUES (?, ?, ?, ?, ?, ?, ?, 1)

    ON CONFLICT(job_id)

    DO UPDATE SET

      job_url =
        COALESCE(
          excluded.job_url,
          jobs.job_url
        ),

      job_title =
        COALESCE(
          excluded.job_title,
          jobs.job_title
        ),

      company_name =
        COALESCE(
          excluded.company_name,
          jobs.company_name
        ),

      is_custom =
        COALESCE(
          excluded.is_custom,
          jobs.is_custom
        ),

      last_seen_at =
        excluded.last_seen_at,

      seen_count =
        jobs.seen_count + 1

  `);


stmts.insertQuestion =
  db.prepare(`

    INSERT INTO questions (

      question_key,
      representative_text,
      normalized_text,
      question_type,
      category,
      canonical_intent,
      mandatory,
      default_options_json,
      answer_options_metadata_json,
      first_seen_at,
      last_seen_at,
      seen_count

    )

    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0)

    ON CONFLICT(question_key)

    DO UPDATE SET

      last_seen_at =
        excluded.last_seen_at,

      category =
        COALESCE(
          questions.category,
          excluded.category
        ),

      mandatory =
        excluded.mandatory

  `);


stmts.insertOccurrence =
  db.prepare(`

    INSERT OR IGNORE INTO question_occurrences (

      job_id,
      question_key,
      source_question_id,
      questionnaire_id,
      questionnaire_type,
      question_text,
      question_type,
      category,
      mandatory,
      prefill_json,
      options_json,
      answer_options_metadata_json,
      skippable,
      captured_at,
      raw_question_json

    )

    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )

  `);


stmts.incrementQuestion =
  db.prepare(`

    UPDATE questions

    SET

      seen_count =
        seen_count + 1,

      last_seen_at = ?

    WHERE question_key = ?

  `);


stmts.insertPrefill =
  db.prepare(`

    INSERT OR REPLACE INTO user_prefills (

      job_id,
      source_question_id,
      value_json,
      captured_at

    )

    VALUES (?, ?, ?, ?)

  `);


stmts.insertCapture =
  db.prepare(`

    INSERT INTO api_captures (

      job_id,
      response_url,
      captured_at,
      apply_redirect_url,
      flow_type,
      current_conversation_name,
      current_node_name,
      current_node,
      raw_json

    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)

  `);


// ============================================================
// RUN RECORD
// ============================================================

const startedAt =
  timestamp();


const runInsert =
  db.prepare(`

    INSERT INTO collector_runs (
      started_at,
      notes
    )

    VALUES (?, ?)

  `);


const runId =
  runInsert.run(
    startedAt,
    "Project Adam Naukri Question Collector"
  ).lastInsertRowid;


// ============================================================
// RUN STATS
// ============================================================

const stats = {

  harvested:
    0,

  processed:
    0,

  questionnaireJobs:
    0,

  questionOccurrences:
    0,

  uniqueQuestionsAdded:
    0

};


// ============================================================
// DETECT QUESTIONNAIRE PAYLOAD
// ============================================================

function findQuestionnairePayload(
  obj
) {

  if (
    !obj ||
    typeof obj !== "object"
  ) {
    return null;
  }


  const candidates = [

    obj,

    obj.data,

    obj.result,

    obj.response,

    obj.payload

  ];


  for (
    const candidate
    of candidates
  ) {

    if (
      candidate &&
      Array.isArray(
        candidate.jobs
      )
    ) {

      const hasQuestions =
        candidate.jobs.some(
          job =>
            Array.isArray(
              job.questionnaire
            ) &&
            job.questionnaire.length > 0
        );


      if (hasQuestions) {

        return candidate;

      }

    }

  }


  return null;

}


// ============================================================
// SAVE QUESTIONNAIRE PAYLOAD
// ============================================================

const persistPayload =
  db.transaction(
    (
      payload,
      responseUrl,
      sourceJobUrl
    ) => {

      const capturedAt =
        timestamp();


      const skippable =
        new Set(
          (
            payload.skippableQuestions ||
            []
          ).map(String)
        );


      const prefills =
        payload.userPrefilledData ||
        {};


      let payloadJobId =
        null;


      let newQuestions =
        0;


      let occurrences =
        0;


      for (
        const job
        of payload.jobs || []
      ) {

        const jobId =
          String(
            job.jobId || ""
          );


        if (!jobId)
          continue;


        if (!payloadJobId)
          payloadJobId = jobId;


        stmts.upsertJob.run(

          jobId,

          sourceJobUrl,

          job.jobTitle ||
            null,

          job.companyName ||
            null,

          job.isCustom
            ? 1
            : 0,

          capturedAt,

          capturedAt

        );


        for (
          const q
          of job.questionnaire || []
        ) {

          const questionText =
            clean(
              q.questionName
            );


          if (!questionText)
            continue;


          const questionType =
            clean(
              q.questionType
            );


          const qKey =
            questionKey(
              questionText,
              questionType
            );


          const existed =
            db.prepare(`

              SELECT 1
              FROM questions
              WHERE question_key = ?

            `).get(qKey);


          stmts.insertQuestion.run(

            qKey,

            questionText,

            normalizeQuestion(
              questionText
            ),

            questionType ||
              null,

            q.category ||
              null,

            q.isMandatory
              ? 1
              : 0,

            JSON.stringify(
              q.answerOption ||
              {}
            ),

            JSON.stringify(
              q.answerOptionsMetadata ||
              {}
            ),

            capturedAt,

            capturedAt

          );


          if (!existed) {

            newQuestions++;

          }


          const sourceQuestionId =
            String(
              q.questionId ||
              ""
            );


          let prefill =
            q.prefillData ??
            null;


          if (
            (
              prefill === null ||
              prefill === undefined
            ) &&
            sourceQuestionId &&
            Object.prototype
              .hasOwnProperty
              .call(
                prefills,
                sourceQuestionId
              )
          ) {

            prefill =
              prefills[
                sourceQuestionId
              ];

          }


          const occurrence =
            stmts.insertOccurrence.run(

              jobId,

              qKey,

              sourceQuestionId ||
                null,

              q.questionnaireId
                ? String(
                    q.questionnaireId
                  )
                : null,

              q.questionnaireType ||
                null,

              questionText,

              questionType ||
                null,

              q.category ||
                null,

              q.isMandatory
                ? 1
                : 0,

              prefill !== null
                ? JSON.stringify(
                    prefill
                  )
                : null,

              JSON.stringify(
                q.answerOption ||
                {}
              ),

              JSON.stringify(
                q.answerOptionsMetadata ||
                {}
              ),

              skippable.has(
                sourceQuestionId
              )
                ? 1
                : 0,

              capturedAt,

              JSON.stringify(q)

          );


          if (
            occurrence.changes === 1
          ) {

            occurrences++;


            stmts.incrementQuestion.run(

              capturedAt,

              qKey

            );

          }

        }


        // ------------------------------------------
        // USER PREFILLS
        // ------------------------------------------

        for (
          const [
            questionId,
            value
          ]
          of Object.entries(
            prefills
          )
        ) {

          stmts.insertPrefill.run(

            jobId,

            String(
              questionId
            ),

            JSON.stringify(
              value
            ),

            capturedAt

          );

        }

      }


      // --------------------------------------------
      // RAW CAPTURE
      // --------------------------------------------

      const chatbot =
        payload.chatbotResponse ||
        {};


      stmts.insertCapture.run(

        payloadJobId,

        responseUrl,

        capturedAt,

        payload.applyRedirectUrl ||
          null,

        payload.flowType ||
          null,

        chatbot.currentConversationName ||
          null,

        chatbot.currentNodeName ||
          null,

        chatbot.currentNode ??
          null,

        JSON.stringify(
          payload
        )

      );


      return {

        jobId:
          payloadJobId,

        newQuestions,

        occurrences

      };

    }
  );


// ============================================================
// MARK JOB
// ============================================================

function markJob(
  jobId,
  url,
  status,
  error = null
) {

  const now =
    timestamp();


  stmts.upsertProcessed.run(

    jobId,

    url,

    status,

    now,

    now,

    error

  );

}


// ============================================================
// SHOULD SKIP JOB
// ============================================================

function shouldSkip(
  jobId
) {

  const row =
    stmts.getProcessed.get(
      jobId
    );


  if (!row)
    return false;


  return [
    "CAPTURED",
    "NO_QUESTIONNAIRE",
    "APPLY_NOT_FOUND",
    "ALREADY_APPLIED"
  ].includes(
    row.status
  );

}


// ============================================================
// HARVEST JOBS
// ============================================================

async function harvestJobs(
  page
) {

  log(
    "HARVEST_START",
    CONFIG.START_URL
  );


  await page.goto(
    CONFIG.START_URL,
    {
      waitUntil:
        "domcontentloaded",

      timeout:
        60000
    }
  );


  await sleep(3000);


  // ----------------------------------------------------------
  // LOGIN CHECK
  // ----------------------------------------------------------

  let titleCount =
    await page.locator(
      "p.title.ellipsis.typ-16Bold"
    ).count();


  if (
    titleCount === 0
  ) {

    log(
      "No job titles found."
    );


    log(
      "If Naukri login is required, log in using the browser."
    );


    await waitForEnter(
      "\nAfter login / Recommended Jobs page is ready, press ENTER here..."
    );


    await page.goto(
      CONFIG.START_URL,
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          60000
      }
    );


    await sleep(3000);

  }


  // ----------------------------------------------------------
  // INTERCEPT window.open
  //
  // Naukri titles call:
  // window.open("/job-listings-...")
  // ----------------------------------------------------------

  await page.evaluate(() => {

    window.__ADAM_HARVESTED =
      [];


    window.__ADAM_CURRENT_TITLE =
      null;


    window.open = function(
      url
    ) {

      if (url) {

        window
          .__ADAM_HARVESTED
          .push({

            title:
              window
                .__ADAM_CURRENT_TITLE ||
              "",

            url:
              String(url)

          });

      }


      return null;

    };

  });


  let stablePasses =
    0;


  let previousCount =
    0;


  let previousHeight =
    0;


  for (
    let pass = 0;
    pass <
      CONFIG.HARVEST_SCROLL_PASSES;
    pass++
  ) {

    await page.evaluate(() => {

      const titles = [

        ...document.querySelectorAll(
          "p.title.ellipsis.typ-16Bold"
        )

      ];


      for (
        const title
        of titles
      ) {

        const rect =
          title
            .getBoundingClientRect();


        const style =
          getComputedStyle(
            title
          );


        const visible =

          style.display !==
            "none"

          &&

          style.visibility !==
            "hidden"

          &&

          rect.width > 0

          &&

          rect.height > 0;


        if (!visible)
          continue;


        window.__ADAM_CURRENT_TITLE =
          (
            title.innerText ||
            title.textContent ||
            ""
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim();


        title.click();

      }


      window.__ADAM_CURRENT_TITLE =
        null;

    });


    await sleep(500);


    const state =
      await page.evaluate(() => ({

        count:
          window
            .__ADAM_HARVESTED
            ?.length || 0,

        height:
          document.documentElement
            .scrollHeight

      }));


    await page.evaluate(() => {

      window.scrollBy(
        0,
        Math.max(
          window.innerHeight *
            0.85,
          600
        )
      );

    });


    await sleep(800);


    if (
      state.count ===
        previousCount

      &&

      state.height ===
        previousHeight
    ) {

      stablePasses++;

    }

    else {

      stablePasses = 0;

    }


    previousCount =
      state.count;


    previousHeight =
      state.height;


    if (
      stablePasses >= 5
    ) {

      break;

    }

  }


  const rawJobs =
    await page.evaluate(() =>
      window.__ADAM_HARVESTED ||
      []
    );


  const deduped =
    new Map();


  for (
    const item
    of rawJobs
  ) {

    if (!item.url)
      continue;


    let absoluteUrl;


    try {

      absoluteUrl =
        new URL(
          item.url,
          location.origin
        ).href;

    }

    catch {

      continue;

    }


    const jobId =
      extractJobId(
        absoluteUrl
      );


    if (!jobId)
      continue;


    if (
      !deduped.has(jobId)
    ) {

      deduped.set(
        jobId,
        {

          jobId,

          title:
            clean(item.title),

          url:
            absoluteUrl

        }
      );

    }

  }


  const jobs =
    [...deduped.values()];


  log(
    "HARVEST_DONE",
    `jobs=${jobs.length}`
  );


  return jobs;

}


// ============================================================
// CLICK APPLY
// ============================================================

async function clickApply(
  page
) {

  return await page.evaluate(() => {

    const clean =
      text =>
        String(text || "")
          .replace(/\s+/g, " ")
          .trim();


    const visible =
      el => {

        if (!el)
          return false;


        const style =
          getComputedStyle(el);


        const rect =
          el.getBoundingClientRect();


        return (

          style.display !==
            "none"

          &&

          style.visibility !==
            "hidden"

          &&

          rect.width > 0

          &&

          rect.height > 0

        );

      };


    const candidates = [

      ...document.querySelectorAll(
        `
        button,
        [role="button"],
        a,
        input[type="button"],
        input[type="submit"]
        `
      )

    ].filter(visible);


    const apply =
      candidates.find(el => {

        const text =
          clean(
            el.innerText ||
            el.value ||
            el.textContent
          );


        return (
          /^apply$/i.test(text)
          ||
          /^apply now$/i.test(text)
        );

      });


    if (!apply) {

      return {

        clicked:
          false,

        reason:
          "APPLY_NOT_FOUND"

      };

    }


    apply.click();


    return {

      clicked:
        true,

      text:
        clean(
          apply.innerText ||
          apply.value ||
          apply.textContent
        ),

      tag:
        apply.tagName,

      className:
        typeof apply.className ===
        "string"

          ? apply.className

          : ""

    };

  });

}


// ============================================================
// PROCESS ONE JOB
// ============================================================

async function processJob(
  page,
  job,
  safety
) {

  const {
    jobId,
    url
  } = job;


  if (
    shouldSkip(jobId)
  ) {

    log(
      "SKIP_PROCESSED",
      jobId
    );

    return;
  }


  safety.currentJobId =
    jobId;


  safety.blockedSubmission =
    false;


  log(
    "OPEN_JOB",
    jobId,
    clean(job.title)
  );


  let captureResolve;


  let captureDone =
    false;


  const capturePromise =
    new Promise(resolve => {

      captureResolve =
        resolve;

    });


  // ----------------------------------------------------------
  // RESPONSE LISTENER
  // ----------------------------------------------------------

  const responseHandler =
    async response => {

      if (captureDone)
        return;


      try {

        const contentType =
          response.headers()[
            "content-type"
          ] || "";


        if (
          !contentType
            .toLowerCase()
            .includes(
              "application/json"
            )
        ) {

          return;

        }


        const payload =
          await response.json();


        const questionnaire =
          findQuestionnairePayload(
            payload
          );


        if (!questionnaire)
          return;


        captureDone =
          true;


        captureResolve({

          payload:
            questionnaire,

          responseUrl:
            response.url()

        });

      }

      catch {

        // Ignore non-JSON or unreadable responses.

      }

    };


  page.on(
    "response",
    responseHandler
  );


  try {

    await page.goto(
      url,
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          60000
      }
    );


    await sleep(2000);


    // --------------------------------------------------------
    // Basic page status
    // --------------------------------------------------------

    const bodyText =
      clean(
        await page
          .locator("body")
          .innerText()
          .catch(() => "")
      );


    if (
      /already applied/i
        .test(bodyText)
    ) {

      markJob(
        jobId,
        url,
        "ALREADY_APPLIED"
      );


      log(
        "ALREADY_APPLIED",
        jobId
      );


      return;
    }


    // --------------------------------------------------------
    // CLICK APPLY
    // --------------------------------------------------------

    const applyResult =
      await clickApply(
        page
      );


    if (
      !applyResult.clicked
    ) {

      markJob(
        jobId,
        url,
        "APPLY_NOT_FOUND"
      );


      log(
        "APPLY_NOT_FOUND",
        jobId
      );


      return;
    }


    log(
      "APPLY_CLICKED",
      jobId,
      `waiting=${CONFIG.QUESTION_WAIT_MS}ms`
    );


    // --------------------------------------------------------
    // WAIT FOR QUESTIONNAIRE
    // --------------------------------------------------------

    const timeoutPromise =
      sleep(
        CONFIG.QUESTION_WAIT_MS
      )
        .then(() => null);


    const capture =
      await Promise.race([

        capturePromise,

        timeoutPromise

      ]);


    // --------------------------------------------------------
    // QUESTIONNAIRE CAPTURED
    // --------------------------------------------------------

    if (capture) {

      const saved =
        persistPayload(

          capture.payload,

          capture.responseUrl,

          url

        );


      markJob(
        jobId,
        url,
        "CAPTURED"
      );


      stats.questionnaireJobs++;

      stats.questionOccurrences +=
        saved.occurrences;

      stats.uniqueQuestionsAdded +=
        saved.newQuestions;


      log(
        "QUESTIONNAIRE_CAPTURED",
        `job=${jobId}`,
        `occurrences=${saved.occurrences}`,
        `unique_added=${saved.newQuestions}`
      );


      return;
    }


    // --------------------------------------------------------
    // NO QUESTIONNAIRE
    // --------------------------------------------------------

    const status =
      safety.blockedSubmission

        ? "NO_QUESTIONNAIRE_DIRECT_APPLY_BLOCKED"

        : "NO_QUESTIONNAIRE";


    markJob(
      jobId,
      url,
      status
    );


    log(
      status,
      jobId
    );

  }

  catch (error) {

    markJob(
      jobId,
      url,
      "FAILED",
      String(
        error.message ||
        error
      )
    );


    log(
      "JOB_FAILED",
      jobId,
      clean(
        error.message ||
        error
      )
    );

  }

  finally {

    page.off(
      "response",
      responseHandler
    );


    stats.processed++;

  }

}


// ============================================================
// MAIN
// ============================================================

(async () => {

  log(
    "=========================================="
  );

  log(
    "PROJECT ADAM QUESTION COLLECTOR STARTING"
  );

  log(
    `DB=${CONFIG.DB_PATH}`
  );

  log(
    `RUN_HOURS=${CONFIG.RUN_HOURS}`
  );

  log(
    `MAX_JOBS=${CONFIG.MAX_JOBS}`
  );

  log(
    `HEADLESS=${CONFIG.HEADLESS}`
  );

  log(
    "=========================================="
  );


  const browser =
    await chromium
      .launchPersistentContext(

        CONFIG.PROFILE_DIR,

        {

          headless:
            CONFIG.HEADLESS,

          viewport: null,

          args: [
            "--start-maximized"
          ]

        }

      );


  // ==========================================================
  // HARVEST PAGE
  // ==========================================================

  let harvestPage =
    browser.pages()[0];


  if (!harvestPage) {

    harvestPage =
      await browser.newPage();

  }


  // ==========================================================
  // JOB PAGE
  // ==========================================================

  const jobPage =
    await browser.newPage();


  // ==========================================================
  // SAFETY GUARD
  //
  // BLOCK FINAL NAUKRI APPLICATION SUBMISSION
  // ==========================================================

  const safety = {

    currentJobId:
      null,

    blockedSubmission:
      false

  };


  await jobPage.route(

    "**/*",

    async route => {

      const request =
        route.request();


      const url =
        request.url();


      try {

        const parsed =
          new URL(url);


        if (
          parsed.pathname.includes(
            "/myapply/saveApply"
          )
        ) {

          safety.blockedSubmission =
            true;


          log(
            "SAFETY_BLOCK",
            safety.currentJobId ||
              "UNKNOWN_JOB",
            parsed.pathname
          );


          await route.abort();


          return;

        }

      }

      catch {}


      await route.continue();

    }

  );


  // ==========================================================
  // RUN LOOP
  // ==========================================================

  const runUntil =
    Date.now() +
    (
      CONFIG.RUN_HOURS *
      60 *
      60 *
      1000
    );


  let totalAttempted =
    0;


  let cycle =
    0;


  try {

    while (
      Date.now() <
        runUntil

      &&

      totalAttempted <
        CONFIG.MAX_JOBS
    ) {

      cycle++;


      log(
        `COLLECTION_CYCLE=${cycle}`
      );


      let jobs;


      try {

        jobs =
          await harvestJobs(
            harvestPage
          );

      }

      catch (error) {

        log(
          "HARVEST_FAILED",
          clean(
            error.message ||
            error
          )
        );


        await sleep(
          60 * 1000
        );


        continue;

      }


      stats.harvested +=
        jobs.length;


      let newJobsThisCycle =
        0;


      for (
        const job
        of jobs
      ) {

        if (
          Date.now() >=
            runUntil
        ) {
          break;
        }


        if (
          totalAttempted >=
            CONFIG.MAX_JOBS
        ) {
          break;
        }


        if (
          shouldSkip(
            job.jobId
          )
        ) {

          continue;

        }


        newJobsThisCycle++;


        totalAttempted++;


        await processJob(

          jobPage,

          job,

          safety

        );


        await sleep(
          CONFIG.JOB_GAP_MS
        );

      }


      log(
        "CYCLE_DONE",
        `new_jobs=${newJobsThisCycle}`,
        `total_attempted=${totalAttempted}`
      );


      // --------------------------------------------------------
      // No new jobs found.
      // Wait before checking Recommended Jobs again.
      // --------------------------------------------------------

      if (
        Date.now() <
          runUntil

        &&

        totalAttempted <
          CONFIG.MAX_JOBS
      ) {

        const waitMs =
          CONFIG.CYCLE_WAIT_MINUTES *
          60 *
          1000;


        log(
          "WAITING_FOR_NEXT_CYCLE",
          `${CONFIG.CYCLE_WAIT_MINUTES} minutes`
        );


        await sleep(
          waitMs
        );

      }

    }

  }

  catch (error) {

    log(
      "FATAL_ERROR",
      clean(
        error.message ||
        error
      )
    );

  }

  finally {

    // ========================================================
    // UPDATE RUN
    // ========================================================

    const endedAt =
      timestamp();


    db.prepare(`

      UPDATE collector_runs

      SET

        ended_at = ?,

        jobs_harvested = ?,

        jobs_processed = ?,

        questionnaire_jobs = ?,

        total_question_occurrences = ?,

        unique_questions_added = ?

      WHERE run_id = ?

    `).run(

      endedAt,

      stats.harvested,

      stats.processed,

      stats.questionnaireJobs,

      stats.questionOccurrences,

      stats.uniqueQuestionsAdded,

      runId

    );


    // ========================================================
    // SUMMARY
    // ========================================================

    const totalQuestions =
      db.prepare(`

        SELECT COUNT(*) AS count
        FROM questions

      `).get().count;


    const totalOccurrences =
      db.prepare(`

        SELECT COUNT(*) AS count
        FROM question_occurrences

      `).get().count;


    const totalJobs =
      db.prepare(`

        SELECT COUNT(*) AS count
        FROM processed_jobs

      `).get().count;


    log(
      "=========================================="
    );

    log(
      "COLLECTOR FINISHED"
    );

    log(
      `PROCESSED_JOBS=${totalJobs}`
    );

    log(
      `UNIQUE_QUESTIONS=${totalQuestions}`
    );

    log(
      `QUESTION_OCCURRENCES=${totalOccurrences}`
    );

    log(
      `DB=${CONFIG.DB_PATH}`
    );

    log(
      "=========================================="
    );


    db.close();


    await browser.close();

  }

})();