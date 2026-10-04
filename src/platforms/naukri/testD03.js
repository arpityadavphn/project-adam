^\
const path =
  require("path");

const {
  chromium
} =
  require("playwright");

const {
  runD02
} =
  require("./nodes/D02_jobState");

const {
  runD03
} =
  require("./nodes/D03_apply");


const PROFILE_DIR =
  path.resolve(
    "./browser-profile"
  );


const JOB_URL =
  process.env.JOB_URL;


if (!JOB_URL) {

  console.error(
    "\n❌ JOB_URL is required."
  );

  console.error(
    'Example: JOB_URL="https://www.naukri.com/job-listings-..." node src/platforms/naukri/testD03.js'
  );

  process.exit(1);

}


(async () => {

  console.log(
    "PROJECT ADAM — D02 → D03 LIVE TEST"
  );


  console.log(
    "\n⚠️ IMPORTANT:"
  );

  console.log(
    "D03 will actually click Apply."
  );

  console.log(
    "Use only a job you genuinely intend to apply to.\n"
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


  const page =
    context.pages()[0] ||
    await context.newPage();


  // ==========================================================
  // OPEN USER-SELECTED JOB
  // ==========================================================

  console.log(
    "OPENING:"
  );

  console.log(
    JOB_URL
  );


  await page.goto(
    JOB_URL,
    {

      waitUntil:
        "domcontentloaded",

      timeout:
        60000

    }
  );


  // ==========================================================
  // BUILD HARVESTED JOB OBJECT
  //
  // Mimics D01 input using the URL itself.
  // ==========================================================

  const pathname =
    new URL(
      JOB_URL
    ).pathname;


  const jobId =
    pathname.match(
      /-(\d{10,})\/?$/
    )?.[1] ||
    null;


  if (!jobId) {

    throw new Error(
      "Could not extract Naukri job ID from JOB_URL."
    );

  }


  const harvestedJob = {

    index:
      0,

    title:
      "",

    jobId,

    url:
      new URL(
        pathname,
        "https://www.naukri.com"
      ).href,

    fullUrl:
const path =
  require("path");

const {
  chromium
} =
  require("playwright");

const {
  runD02
} =
  require("./nodes/D02_jobState");

const {
  runD03
} =
  require("./nodes/D03_apply");


const PROFILE_DIR =
  path.resolve(
    "./browser-profile"
  );


const JOB_URL =
  process.env.JOB_URL;


if (!JOB_URL) {

  console.error(
    "\n❌ JOB_URL is required."
  );

  console.error(
    '\nExample:\nJOB_URL="https://www.naukri.com/job-listings-..." node src/platforms/naukri/testD03.js'
  );

  process.exit(1);

}


(async () => {

  console.log(
    "============================================================"
  );

  console.log(
    "PROJECT ADAM — D03 ISOLATED LIVE TEST"
  );

  console.log(
    "============================================================"
  );

  console.log(
    "\n⚠️ D03 WILL ACTUALLY CLICK APPLY."
  );

  console.log(
    "Use only a job you genuinely intend to apply to.\n"
  );


  // ==========================================================
  // 1. OPEN PERSISTENT BROWSER
  // ==========================================================

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


  const page =
    context.pages()[0] ||
    await context.newPage();


  // ==========================================================
  // 2. GLOBAL NETWORK DIAGNOSTIC
  //
  // This is OUTSIDE D03.
  // Even if D03 misses the response, this test should show
  // what Naukri actually called.
  // ==========================================================

  const networkEvents =
    [];


  const networkListener =
    response => {

      const url =
        response.url();


      if (
        !/apply|workflow|chatbot|myapply/i.test(
          url
        )
      ) {

        return;

      }


      const event = {

        method:
          response
            .request()
            .method(),

        status:
          response.status(),

        url

      };


      networkEvents.push(
        event
      );


      console.log(
        "\n🌐 TEST NETWORK:"
      );

      console.log(
        event.method,
        event.status,
        event.url
      );

    };


  context.on(
    "response",
    networkListener
  );


  // ==========================================================
  // 3. OPEN CHOSEN JOB
  // ==========================================================

  console.log(
    "\nOPENING JOB:"
  );

  console.log(
    JOB_URL
  );


  await page.goto(
    JOB_URL,
    {

      waitUntil:
        "domcontentloaded",

      timeout:
        60000

    }
  );


  // ==========================================================
  // 4. BUILD D01-LIKE JOB INPUT
  // ==========================================================

  const parsedUrl =
    new URL(
      JOB_URL
    );


  const jobId =
    parsedUrl
      .pathname
      .match(
        /-(\d{10,})\/?$/
      )?.[1] ||
    null;


  if (!jobId) {

    throw new Error(
      "Unable to extract jobId from JOB_URL."
    );

  }


  const harvestedJob = {

    index:
      0,

    title:
      "",

    jobId,

    url:
      parsedUrl.origin +
      parsedUrl.pathname,

    fullUrl:
      JOB_URL

  };


  console.log(
    "\nHARVESTED INPUT:"
  );

  console.log(
    harvestedJob
  );


  // ==========================================================
  // 5. D02 — PREPARE VALID HANDOFF
  // ==========================================================

  const d02 =
    await runD02(
      page,
      harvestedJob
    );


  console.log(
    "\n============================================================"
  );

  console.log(
    "D02 HANDOFF"
  );

  console.log(
    "============================================================"
  );


  console.dir(
    d02,
    {
      depth:
        4
    }
  );


  if (
    !d02.success ||
    d02.state !==
      "APPLY_AVAILABLE"
  ) {

    console.log(
      "\n⛔ D03 NOT EXECUTED"
    );

    console.log(
      "D02 state:",
      d02.state
    );

    console.log(
      "\nBrowser left open."
    );

    await new Promise(
      () => {}
    );

  }


  // ==========================================================
  // 6. D03
  // ==========================================================

  console.log(
    "\n============================================================"
  );

  console.log(
    "STARTING D03"
  );

  console.log(
    "============================================================"
  );


  const startedAt =
    Date.now();


  const d03 =
    await runD03(
      page,
      d02
    );


  const durationMs =
    Date.now() -
    startedAt;


  // Give late network events a moment to appear.
  await page.waitForTimeout(
    1500
  );


  // ==========================================================
  // 7. FINAL D03 RESULT
  // ==========================================================

  console.log(
    "\n============================================================"
  );

  console.log(
    "FINAL D03 RESULT"
  );

  console.log(
    "============================================================"
  );


  console.dir(
    d03,
    {
      depth:
        5
    }
  );


  // ==========================================================
  // 8. SUMMARY
  // ==========================================================

  console.log(
    "\nD03 SUMMARY:"
  );


  console.table([
    {

      success:
        d03.success,

      state:
        d03.state,

      jobId:
        d03.job?.jobId,

      title:
        d03.job?.title,

      company:
        d03.job?.company,

      workflowReceived:
        d03.workflow
          ?.received,

      httpStatus:
        d03.workflow
          ?.httpStatus,

      questions:
        d03.workflow
          ?.questionnaireCount,

      chatbot:
        d03.workflow
          ?.hasChatbotResponse,

      repoQuestions:
        d03.questionRepository
          ?.questionsFound,

      repoNew:
        d03.questionRepository
          ?.uniqueAdded,

      nextNode:
        d03.nextNode,

      durationMs

    }
  ]);


  // ==========================================================
  // 9. NETWORK EVENTS
  // ==========================================================

  console.log(
    "\n============================================================"
  );

  console.log(
    "APPLY-RELATED NETWORK EVENTS"
  );

  console.log(
    "============================================================"
  );


  if (
    networkEvents.length
  ) {

    console.table(
      networkEvents
    );

  }

  else {

    console.log(
      "⚠️ No apply/workflow/chatbot/myapply responses were observed."
    );

  }


  // ==========================================================
  // 10. KEEP BROWSER OPEN
  // ==========================================================

  context.off(
    "response",
    networkListener
  );


  console.log(
    "\nBrowser left open for inspection."
  );

  console.log(
    "Press Ctrl+C when finished."
  );


  await new Promise(
    () => {}
  );

})()
.catch(
  error => {

    console.error(
      "\n❌ D03 TEST FAILED"
    );

    console.error(
      error
    );

    process.exit(1);

  }
);
      JOB_URL

  };


  // ==========================================================
  // D02
  // ==========================================================

  const d02 =
    await runD02(
      page,
      harvestedJob
    );


  console.log(
    "\nD02 HANDOFF:"
  );


  console.dir(
    d02,
    {
      depth:
        3
    }
  );


  if (
    !d02.success ||
    d02.state !==
      "APPLY_AVAILABLE"
  ) {

    console.log(
      "\n⛔ D03 NOT EXECUTED."
    );

    console.log(
      `D02 state: ${d02.state}`
    );


    await new Promise(
      () => {}
    );

  }


  // ==========================================================
  // FINAL SAFETY DISPLAY
  // ==========================================================

  console.log(
    "\n============================================================"
  );

  console.log(
    "D03 IS ABOUT TO CLICK APPLY"
  );

  console.log(
    "============================================================"
  );

  console.log(
    "Job ID:",
    d02.job?.jobId
  );

  console.log(
    "Title:",
    d02.job?.title
  );

  console.log(
    "URL:",
    d02.job?.fullUrl
  );

  console.log(
    "============================================================\n"
  );


  // Small visible pause before the real action.
  await page.waitForTimeout(
    2000
  );


  // ==========================================================
  // D03
  // ==========================================================

  const d03 =
    await runD03(
      page,
      d02
    );


  console.log(
    "\n============================================================"
  );

  console.log(
    "FINAL D03 RESULT"
  );

  console.log(
    "============================================================"
  );


  console.dir(
    d03,
    {
      depth:
        4
    }
  );


  console.log(
    "\nSUMMARY:"
  );


  console.table([
    {

      success:
        d03.success,

      state:
        d03.state,

      jobId:
        d03.job?.jobId,

      title:
        d03.job?.title,

      company:
        d03.job?.company,

      workflowReceived:
        d03.workflow?.received,

      questions:
        d03.workflow?.questionnaireCount,

      chatbot:
        d03.workflow?.hasChatbotResponse,

      repoQuestions:
        d03.questionRepository
          ?.questionsFound,

      repoNew:
        d03.questionRepository
          ?.uniqueAdded,

      nextNode:
        d03.nextNode

    }
  ]);


  console.log(
    "\nBrowser left open for inspection."
  );

  console.log(
    "Press Ctrl+C when finished."
  );


  await new Promise(
    () => {}
  );

})()
.catch(
  error => {

    console.error(
      "\n❌ D03 TEST FAILED"
    );

    console.error(
      error
    );

    process.exit(1);

  }
);
