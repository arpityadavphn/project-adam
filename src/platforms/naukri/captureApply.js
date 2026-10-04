const path = require("path");
const { chromium } = require("playwright");

const {
  DB_PATH,
  collectFromApplyResponse,
  getQuestionCount,
  getOccurrenceCount
} = require("../../db/questionRepo");


// ============================================================
// PROJECT ADAM
// NAUKRI APPLY RESPONSE CAPTURE — LIVE SMOKE TEST
//
// Purpose:
// 1. Open Naukri using our persistent logged-in profile
// 2. Listen for /apply-workflow/v1/apply
// 3. Capture the JSON response
// 4. Save recruiter questionnaire into SQLite
//
// IMPORTANT:
// This script does NOT click Apply automatically.
// You manually choose a job you actually want to apply to.
// ============================================================


const PROFILE_DIR =
  path.resolve(
    "./browser-profile"
  );


const APPLY_ENDPOINT =
  "/cloudgateway-workflow/workflow-services/apply-workflow/v1/apply";


const START_URL =
  "https://www.naukri.com/mnjuser/recommendedjobs";


// Keep track so we don't attach twice.
const attachedPages =
  new WeakSet();


// ============================================================
// RESPONSE HANDLER
// ============================================================

async function handleResponse(
  response
) {

  const url =
    response.url();


  if (
    !url.includes(
      APPLY_ENDPOINT
    )
  ) {
    return;
  }


  console.log(
    "\n============================================================"
  );

  console.log(
    "🎯 ADAM — APPLY WORKFLOW RESPONSE DETECTED"
  );

  console.log(
    "URL:",
    url
  );

  console.log(
    "STATUS:",
    response.status()
  );


  try {

    const payload =
      await response.json();


    console.log(
      "\nRESPONSE SUMMARY:"
    );


    console.log({
      statusCode:
        payload.statusCode,

      jobs:
        Array.isArray(payload.jobs)
          ? payload.jobs.length
          : 0,

      flowType:
        payload.flowType,

      hasChatbotResponse:
        !!payload.chatbotResponse,

      skippableQuestions:
        Array.isArray(
          payload.skippableQuestions
        )
          ? payload.skippableQuestions.length
          : 0
    });


    // --------------------------------------------------------
    // Inspect jobs
    // --------------------------------------------------------

    for (
      const job
      of payload.jobs || []
    ) {

      console.log(
        "\nJOB:"
      );

      console.log({
        jobId:
          job.jobId,

        jobTitle:
          job.jobTitle,

        companyName:
          job.companyName,

        status:
          job.status,

        message:
          job.message,

        questionnaireCount:
          Array.isArray(
            job.questionnaire
          )
            ? job.questionnaire.length
            : 0
      });

    }


    // --------------------------------------------------------
    // SAVE INTO QUESTION REPOSITORY
    // --------------------------------------------------------

    const result =
      collectFromApplyResponse(
        payload
      );


    console.log(
      "\nQUESTION REPOSITORY RESULT:"
    );

    console.log({
      success:
        result.success,

      questionsFound:
        result.questionsFound,

      uniqueAdded:
        result.uniqueAdded
    });


    if (
      result.collectedQuestions?.length
    ) {

      console.log(
        "\nQUESTIONS CAPTURED:"
      );

      console.table(

        result
          .collectedQuestions
          .map(q => ({

            questionId:
              q.questionId,

            type:
              q.type,

            category:
              q.category,

            question:
              q.question

          }))

      );

    }


    console.log(
      "\nDATABASE TOTALS:"
    );

    console.log({
      uniqueQuestions:
        getQuestionCount(),

      occurrences:
        getOccurrenceCount()
    });


    console.log(
      "\nDB:",
      DB_PATH
    );


  } catch (
    error
  ) {

    console.error(
      "❌ Could not process Apply response:"
    );

    console.error(
      error
    );

  }


  console.log(
    "============================================================\n"
  );

}


// ============================================================
// PAGE ATTACHMENT
// ============================================================

function attachPage(
  page
) {

  if (
    attachedPages.has(page)
  ) {
    return;
  }


  attachedPages.add(
    page
  );


  console.log(
    "📄 Watching page:",
    page.url() || "new page"
  );


  page.on(
    "response",
    handleResponse
  );


  page.on(
    "close",
    () => {

      console.log(
        "📄 Page closed."
      );

    }
  );

}


// ============================================================
// MAIN
// ============================================================

(async () => {

  console.log(
    "============================================================"
  );

  console.log(
    "PROJECT ADAM — NAUKRI APPLY CAPTURE"
  );

  console.log(
    "============================================================"
  );

  console.log(
    "Profile:",
    PROFILE_DIR
  );

  console.log(
    "Database:",
    DB_PATH
  );


  const context =
    await chromium
      .launchPersistentContext(
        PROFILE_DIR,
        {

          headless:
            false,

          viewport:
            null,

          args: [
            "--start-maximized"
          ]

        }
      );


  // Attach to existing browser pages.
  for (
    const page
    of context.pages()
  ) {

    attachPage(
      page
    );

  }


  // Attach automatically to future tabs/popups.
  context.on(
    "page",
    page => {

      attachPage(
        page
      );

    }
  );


  let page =
    context.pages()[0];


  if (!page) {

    page =
      await context.newPage();

    attachPage(
      page
    );

  }


  console.log(
    "\n🌐 Opening Naukri..."
  );


  await page.goto(
    START_URL,
    {
      waitUntil:
        "domcontentloaded",

      timeout:
        60000
    }
  );


  console.log(
    "\n✅ CAPTURE LISTENER ACTIVE"
  );

  console.log(
    "\nFor this smoke test:"
  );

  console.log(
    "1. Choose ONE job you genuinely want to apply to."
  );

  console.log(
    "2. Open the job."
  );

  console.log(
    "3. Click Apply manually."
  );

  console.log(
    "4. Adam will capture the /apply-workflow response."
  );

  console.log(
    "5. If it has recruiter questions, they will be written to SQLite."
  );

  console.log(
    "\nPress Ctrl+C in this terminal when finished.\n"
  );


  // Keep Node alive.
  await new Promise(
    () => {}
  );

})()
.catch(
  error => {

    console.error(
      "\n❌ PROJECT ADAM FAILED"
    );

    console.error(
      error
    );

    process.exit(1);

  }
);
