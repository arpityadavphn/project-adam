const { chromium } = require("playwright");

(async () => {

  const context =
    await chromium.launchPersistentContext(
      "./browser-profile",
      {
        headless: false,
        viewport: null,
        args: ["--start-maximized"]
      }
    );

  const page =
    context.pages()[0] ||
    await context.newPage();

  console.log("Opening Naukri...");

  try {

    await page.goto(
      "https://www.naukri.com/mnjuser/recommendedjobs",
      {
        waitUntil: "commit",
        timeout: 30000
      }
    );

  } catch (err) {

    console.log(
      "Navigation warning:",
      err.message
    );

  }


  console.log("\nBrowser is open.");
  console.log("If login is required, login manually.");
  console.log("Keep this terminal running.\n");


  while (true) {

    try {

      const url =
        page.url();

      const pageTitle =
        await page.title()
          .catch(() => "");

      const jobTitles =
        await page.locator(
          "p.title.ellipsis.typ-16Bold"
        ).count();

      const body =
        await page.locator("body")
          .innerText()
          .catch(() => "");


      console.log(
        "\n----------------------------"
      );

      console.log(
        "URL:",
        url
      );

      console.log(
        "PAGE TITLE:",
        pageTitle
      );

      console.log(
        "JOB TITLES:",
        jobTitles
      );

      console.log(
        "BODY SAMPLE:"
      );

      console.log(
        body
          .replace(/\s+/g, " ")
          .slice(0, 400)
      );


      if (jobTitles > 0) {

        console.log(
          "\n✅ NAUKRI JOB PAGE DETECTED"
        );

        console.log(
          `✅ Found ${jobTitles} job titles`
        );

        console.log(
          "\nWe are ready for the collector."
        );

        break;
      }

    }

    catch (err) {

      console.log(
        "Probe error:",
        err.message
      );

    }


    await page.waitForTimeout(
      5000
    );

  }


  console.log(
    "\nBrowser will stay open."
  );

  console.log(
    "Press Ctrl+C when finished."
  );


  await new Promise(() => {});

})();
