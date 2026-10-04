const path =
  require("path");

const {
  chromium
} =
  require("playwright");

const {
  runD01
} =
  require("./nodes/D01_harvest");

const {
  runD02
} =
  require("./nodes/D02_jobState");


const PROFILE_DIR =
  path.resolve(
    "./browser-profile"
  );


const START_URL =
  "https://www.naukri.com/mnjuser/recommendedjobs";


(async () => {

  console.log(
    "PROJECT ADAM — D01 → D02 LIVE TEST"
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
  // D01
  // ==========================================================

  await page.goto(
    START_URL,
    {

      waitUntil:
        "domcontentloaded",

      timeout:
        60000

    }
  );


  const d01 =
    await runD01(
      page,
      {
        testLimit: 1
      }
    );


  if (
    !d01.success ||
    !d01.jobs.length
  ) {

    throw new Error(
      "D01 did not return a job."
    );

  }


  const job =
    d01.jobs[0];


  console.log(
    "\nOPENING JOB:"
  );

  console.log(
    job
  );


  // ==========================================================
  // OPEN JOB
  // ==========================================================

  await page.goto(
    job.fullUrl,
    {

      waitUntil:
        "domcontentloaded",

      timeout:
        60000

    }
  );


  // ==========================================================
  // D02
  // ==========================================================

  const d02 =
    await runD02(
      page,
      job
    );


  console.log(
    "\nFINAL D02 RESULT:"
  );


  console.dir(
    d02,
    {
      depth:
        null
    }
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
      "\n❌ TEST FAILED"
    );

    console.error(
      error
    );

    process.exit(1);

  }
);
