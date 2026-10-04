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

const {
  runD05
} =
  require("./nodes/D05_questionInspector");


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
    "PROJECT ADAM — D02 → D03 → D04 → D05 LIVE TEST"
  );


  console.log(
    "\n⚠️ D03 WILL click Apply."
  );

  console.log(
    "Use a job you genuinely intend to apply to.\n"
  );


  const context =
    await chromium
      .launchPersistentContext(
        PROFILE_DIR,
        {
          headless: false,
          viewport: null,
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
      "Unable to extract jobId."
    );

  }


  const harvestedJob = {

    index: 0,

    title: "",

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

    throw new Error(
      `D02 stopped pipeline: ${d02.state}`
    );

  }


  // ==========================================================
  // D03
  // ==========================================================

  const d03 =
    await runD03(
      page,
      d02
    );


  if (!d03.success) {

    throw new Error(
      `D03 failed: ${d03.state}`
    );

  }


  // ==========================================================
  // D04
  // ==========================================================

  const d04 =
    await runD04(
      page,
      d03
    );


  if (
    !d04.success
  ) {

    throw new Error(
      `D04 failed: ${d04.state}`
    );

  }


  if (
    d04.state !==
    "QUESTIONS_PRESENT"
  ) {

    console.log(
      "\nℹ️ No questionnaire to inspect."
    );

    console.log(
      "D04 state:",
      d04.state
    );

    console.log(
      "Next:",
      d04.nextNode
    );

    await new Promise(
      () => {}
    );

  }


  // ==========================================================
  // D05
  // ==========================================================

  const d05 =
    await runD05(
      page,
      d04
    );


  // ==========================================================
  // FINAL RESULT
  // ==========================================================

  console.log(
    "\n============================================================"
  );

  console.log(
    "FINAL D05 RESULT"
  );

  console.log(
    "============================================================"
  );


  console.dir(
    d05,
    {
      depth: 6
    }
  );


  console.log(
    "\nPIPELINE SUMMARY:"
  );


  console.table([
    {

      jobId:
        d05.job?.jobId,

      company:
        d05.job?.company,

      D02:
        d02.state,

      D03:
        d03.state,

      D04:
        d04.state,

      D05:
        d05.state,

      question:
        d05.question?.text,

      type:
        d05.question?.type,

      options:
        d05.question
          ?.options
          ?.length,

      confidence:
        d05.question
          ?.confidence,

      nextNode:
        d05.nextNode,

      error:
        d05.error

    }
  ]);


  if (
    d05.question
      ?.options
      ?.length
  ) {

    console.log(
      "\nCURRENT OPTIONS:"
    );


    console.table(
      d05.question.options
    );

  }


  console.log(
    "\nBrowser left open."
  );

  console.log(
    "D05 has NOT answered anything."
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
      "\n❌ D05 TEST FAILED"
    );

    console.error(
      error
    );

    process.exit(1);

  }
);
