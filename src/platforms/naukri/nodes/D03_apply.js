// ============================================================
// PROJECT ADAM
// D03 — NAUKRI APPLY TRIGGER
// ============================================================
//
// Responsibility:
//
// 1. Validate D02 handoff
// 2. Re-verify current job ID
// 3. Find native Apply fresh
// 4. Arm apply-workflow listener BEFORE click
// 5. Click Apply exactly once
// 6. Capture apply-workflow response
// 7. Store questionnaire in Question Repository
// 8. Enrich job metadata from authoritative API response
// 9. Hand response to D04
//
// D03 DOES NOT:
// - answer questions
// - decide final application outcome
// - click Apply twice
//
// ============================================================

const {
  collectFromApplyResponse
} = require("../../../db/questionRepo");


const NODE =
  "D03_APPLY_TRIGGER";


const APPLY_ENDPOINT =
  "/cloudgateway-workflow/workflow-services/apply-workflow/v1/apply";


async function runD03(
  page,
  d02
) {

  console.log(
    "\n============================================================"
  );

  console.log(
    "D03 — APPLY TRIGGER"
  );

  console.log(
    "============================================================"
  );


  // ==========================================================
  // 1. VALIDATE D02 INPUT
  // ==========================================================

  if (!d02) {

    return fail(
      "D02_MISSING",
      "D02 result was not supplied.",
      null
    );

  }


  if (
    !d02.success ||
    d02.state !== "APPLY_AVAILABLE"
  ) {

    return fail(
      "INVALID_INPUT_STATE",
      `D03 requires APPLY_AVAILABLE. Received: ${d02.state}`,
      d02.job || null
    );

  }


  // ==========================================================
  // 2. VERIFY WE ARE STILL ON THE SAME JOB
  // ==========================================================

  const currentUrl =
    page.url();


  let openedJobId =
    null;


  try {

    openedJobId =
      new URL(currentUrl)
        .pathname
        .match(
          /-(\d{10,})\/?$/
        )?.[1] ||
      null;

  }

  catch {}


  if (
    d02.job?.jobId &&
    openedJobId &&
    d02.job.jobId !== openedJobId
  ) {

    return fail(
      "JOB_ID_MISMATCH",
      `Expected ${d02.job.jobId}, current page is ${openedJobId}`,
      d02.job
    );

  }


  // ==========================================================
  // 3. FIND APPLY CONTROL FRESH
  // ==========================================================

  const applyLocator =
    page
      .locator(
        "button, a, [role='button']"
      )
      .filter({
        hasText:
          /^\s*Apply\s*$/i
      })
      .first();


  try {

    await applyLocator.waitFor({
      state: "visible",
      timeout: 10000
    });

  }

  catch {

    return fail(
      "APPLY_ELEMENT_MISSING",
      "Visible native Apply control could not be found.",
      d02.job
    );

  }


  // ==========================================================
  // 4. SNAPSHOT BEFORE CLICK
  // ==========================================================

  const before = {

    url:
      page.url(),

    timestamp:
      new Date()
        .toISOString()

  };


  // ==========================================================
  // 5. OPTIONAL POPUP WATCH
  // ==========================================================

  let popupUrl =
    null;


  const popupHandler =
    popup => {

      popupUrl =
        popup.url() ||
        null;

    };


  page.on(
    "popup",
    popupHandler
  );


  // ==========================================================
  // 6. ARM APPLY API LISTENER BEFORE CLICK
  // ==========================================================

  const responsePromise =
    page.waitForResponse(

      response => {

        return (
          response
            .url()
            .includes(
              APPLY_ENDPOINT
            ) &&

          response
            .request()
            .method() ===
            "POST"
        );

      },

      {
        timeout: 20000
      }

    );


  // ==========================================================
  // 7. CLICK APPLY EXACTLY ONCE
  // ==========================================================

  let clickError =
    null;


  try {

    console.log(
      "👉 Clicking native Apply once..."
    );


    await applyLocator.click({
      timeout: 10000
    });

  }

  catch (
    error
  ) {

    clickError =
      error.message;

  }


  if (
    clickError
  ) {

    page.off(
      "popup",
      popupHandler
    );


    return fail(
      "APPLY_TRIGGER_FAILED",
      clickError,
      d02.job
    );

  }


  // ==========================================================
  // 8. WAIT FOR APPLY-WORKFLOW RESPONSE
  // ==========================================================

  let response;


  try {

    response =
      await responsePromise;

  }

  catch (
    error
  ) {

    page.off(
      "popup",
      popupHandler
    );


    return {

      node:
        NODE,

      success:
        false,

      timestamp:
        new Date()
          .toISOString(),

      job:
        d02.job,

      state:
        "APPLY_RESPONSE_TIMEOUT",

      reason:
        "Apply was clicked but apply-workflow response was not captured.",

      action: {
        type: "CLICK",
        elementText: "Apply"
      },

      before,

      popupUrl,

      workflow: {
        received: false
      },

      nextNode:
        "D10_EXCEPTION_INSPECTOR",

      error:
        error.message

    };

  }


  page.off(
    "popup",
    popupHandler
  );


  // ==========================================================
  // 9. PARSE RESPONSE
  // ==========================================================

  let payload;


  try {

    payload =
      await response.json();

  }

  catch (
    error
  ) {

    return {

      node:
        NODE,

      success:
        false,

      timestamp:
        new Date()
          .toISOString(),

      job:
        d02.job,

      state:
        "APPLY_RESPONSE_INVALID",

      reason:
        "apply-workflow response was not valid JSON.",

      workflow: {

        received:
          true,

        httpStatus:
          response.status(),

        url:
          response.url()

      },

      nextNode:
        "D10_EXCEPTION_INSPECTOR",

      error:
        error.message

    };

  }


  // ==========================================================
  // 10. COLLECT QUESTIONS INTO SQLITE
  // ==========================================================

  let repoResult =
    null;


  try {

    repoResult =
      collectFromApplyResponse(
        payload,
        d02.job || {}
      );

  }

  catch (
    error
  ) {

    console.warn(
      "⚠️ Question Repository write failed:",
      error.message
    );

  }


  // ==========================================================
  // 11. ANALYZE RESPONSE WITHOUT ROUTING FINAL OUTCOME
  // ==========================================================

  const jobs =
    Array.isArray(
      payload.jobs
    )
      ? payload.jobs
      : [];


  const apiJob =
    jobs.find(
      job =>
        String(
          job.jobId || ""
        ) ===
        String(
          d02.job?.jobId || ""
        )
    ) ||
    jobs[0] ||
    null;


  const questionnaire =
    Array.isArray(
      apiJob?.questionnaire
    )
      ? apiJob.questionnaire
      : [];


  const questionnaireCount =
    questionnaire.length;


  // ==========================================================
  // 12. ENRICH JOB
  // ==========================================================

  const enrichedJob = {

    ...d02.job,

    jobId:
      String(
        apiJob?.jobId ||
        d02.job?.jobId ||
        ""
      ) ||
      null,

    title:
      apiJob?.jobTitle ||
      d02.job?.title ||
      "",

    company:
      apiJob?.companyName ||
      d02.job?.company ||
      ""

  };


  // ==========================================================
  // 13. AFTER SNAPSHOT
  // ==========================================================

  await page.waitForTimeout(
    500
  );


  const after = {

    url:
      page.url(),

    timestamp:
      new Date()
        .toISOString()

  };


  // ==========================================================
  // 14. OUTPUT CONTRACT
  // ==========================================================

  const result = {

    node:
      NODE,

    success:
      true,

    timestamp:
      new Date()
        .toISOString(),

    job:
      enrichedJob,

    state:
      "APPLY_TRIGGERED",

    reason:
      "Native Apply clicked and apply-workflow response captured.",

    action: {

      type:
        "CLICK",

      elementText:
        "Apply",

      clickCount:
        1

    },

    before,

    after,

    signals: {

      urlChanged:
        before.url !==
        after.url,

      popupOpened:
        !!popupUrl,

      applyWorkflowCaptured:
        true,

      questionnairePresent:
        questionnaireCount > 0

    },

    popupUrl,

    workflow: {

      received:
        true,

      httpStatus:
        response.status(),

      url:
        response.url(),

      statusCode:
        payload.statusCode ??
        null,

      flowType:
        payload.flowType ||
        null,

      hasChatbotResponse:
        !!payload.chatbotResponse,

      questionnaireCount,

      skippableQuestionCount:
        Array.isArray(
          payload.skippableQuestions
        )
          ? payload.skippableQuestions.length
          : 0,

      payload

    },

    questionRepository: {

      success:
        repoResult?.success ??
        null,

      questionsFound:
        repoResult?.questionsFound ??
        0,

      uniqueAdded:
        repoResult?.uniqueAdded ??
        0

    },

    nextNode:
      "D04_POST_APPLY_ROUTER",

    error:
      null

  };


  // ==========================================================
  // 15. LOG
  // ==========================================================

  console.log(
    "\nD03 RESULT:"
  );


  console.table([
    {

      jobId:
        result.job?.jobId,

      title:
        result.job?.title,

      company:
        result.job?.company,

      state:
        result.state,

      httpStatus:
        result.workflow.httpStatus,

      questions:
        result.workflow.questionnaireCount,

      chatbot:
        result.workflow.hasChatbotResponse,

      repoAdded:
        result.questionRepository.uniqueAdded,

      nextNode:
        result.nextNode

    }
  ]);


  return result;

}


// ============================================================
// FAILURE HELPER
// ============================================================

function fail(
  state,
  reason,
  job
) {

  const result = {

    node:
      NODE,

    success:
      false,

    timestamp:
      new Date()
        .toISOString(),

    job:
      job ||
      null,

    state,

    reason,

    workflow: {
      received: false
    },

    nextNode:
      "D10_EXCEPTION_INSPECTOR",

    error:
      reason

  };


  console.error(
    `❌ D03 ${state}:`,
    reason
  );


  return result;

}


module.exports = {
  runD03,
  APPLY_ENDPOINT
};
