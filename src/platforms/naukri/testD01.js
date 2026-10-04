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


const PROFILE_DIR =
  path.resolve(
    "./browser-profile"
  );


const START_URL =
  "https://www.naukri.com/mnjuser/recommendedjobs";


(async () => {

  console.log(
    "PROJECT ADAM — D01 LIVE TEST"
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


  const pages =
    context.pages();


  const page =
    pages[0] ||
    await context.newPage();


  await page.goto(
    START_URL,
    {

      waitUntil:
        "domcontentloaded",

      timeout:
        60000

    }
  );


  const result =
    await runD01(
      page,
      {

        // Start small.
        testLimit: 5

      }
    );


  console.log(
    "\nFINAL D01 RESULT:"
  );


  console.dir(
    result,
    {
      depth: null
    }
  );


  console.log(
    "\nBrowser remains open for inspection."
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
      error
    );

    process.exit(1);

  }
);
