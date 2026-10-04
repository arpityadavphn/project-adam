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

const {
  runD04
} =
  require("./nodes/D04_router");


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

  process.exit(1);

}


(async () => {

  console.log(
    "PROJECT ADAM — D02 → D03 → D04 LIVE TEST"
  );


  console.log(
    "\n⚠️ This test WILL click Apply."
  );

  console.log(
    "Use a job you genuinely intend to apply to.\n"
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
  // OPEN JOB
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
  // BUILD D01-LIKE JOB OBJECT
  // ==========================================================

  const parsedUrl =
    new URL(
      JOB_URL
    );


  const jobId =
    parsedUrl.pathname.match(
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


  // ==========================================================
  // D02
  // ==========================================================

  const d02 =
    await runD02(
      page,
      harvestedJob
    );


  if (
    !d02.success ||
    d02.state !==
      "APPLY_AVAILABLE"
  ) {

    console.log(
      "\n⛔ STOPPED BEFORE D03"
    );

    console.log(
      "D02 state:",
      d02.state
    );

    console.dir(
      d02,
      {
        depth: 4
      }
    );

    await new Promise(
      () => {}
    );

  }


  console.log(
    "\n✅ D02 PASSED"
  );


  // ==========================================================
  // D03
  // ==========================================================

  const d03 =
    await runD03(
      page,
      d02
    );


  if (
    !d03.success
  ) {

    console.log(
      "\n⛔ STOPPED AFTER D03 FAILURE"
    );

    console.dir(
      d03,
      {
        depth: 4
      }
    );

    await new Promise(
      () => {}
    );

  }


  console.log(
    "\n✅ D03 PASSED"
  );


  // ==========================================================
  // D04
  // ==========================================================

  const d04 =
    await runD04(
      page,
      d03
    );


  // ==========================================================
  // FINAL RESULT
  // ==========================================================

  console.log(
    "\n============================================================"
  );

  console.log(
    "FINAL D04 RESULT"
  );

  console.log(
    "============================================================"
  );


  console.dir(
    d04,
    {
      depth:
        5
    }
  );


  console.log(
    "\nPIPELINE SUMMARY:"
  );


  console.table([
    {

      jobId:
        d04.job?.jobId,

      title:
        d04.job?.title,

      company:
        d04.job?.company,

      D02:
        d02.state,

      D03:
        d03.state,

      D04:
        d04.state,

      source:
        d04.source,

      apiQuestions:
        d04.questionnaire
          ?.apiQuestionCount,

      chatbotFound:
        d04.questionnaire
          ?.chatbotFound,

      fields:
        d04.questionnaire
          ?.fieldCount,

      nextNode:
        d04.nextNode,

      error:
        d04.error

    }
  ]);


  console.log(
    "\nBrowser left open."
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
      "\n❌ D04 TEST FAILED"
    );

    console.error(
      error
    );

    process.exit(1);

  }
);
