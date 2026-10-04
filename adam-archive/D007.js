window.ADAM_RUN_D07 =
async function() {

  const NODE =
    "D07_COMMIT_ANSWER";


  const clean = s =>
    (s || "")
      .replace(/\s+/g, " ")
      .trim();


  const visible = el => {

    if (!el)
      return false;

    const style =
      getComputedStyle(el);

    const rect =
      el.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };


  // ============================================================
  // INPUT
  // ============================================================

  const d06 =
    window.ADAM_D06;


  if (
    !d06 ||
    d06.success !== true ||
    d06.state !==
      "ANSWER_SELECTED"
  ) {

    const result = {

      node: NODE,

      success: false,

      state:
        "INVALID_INPUT_STATE",

      reason:
        "D07 requires successful D06 ANSWER_SELECTED",

      nextNode:
        "D06_ANSWER_ACTOR"

    };

    window.ADAM_D07 =
      result;

    return result;
  }


  // ============================================================
  // COMMIT ELEMENT
  // ============================================================

  const save = [

    ...document.querySelectorAll(
      ".sendMsg"
    )

  ]
    .filter(visible)

    .find(el =>

      clean(el.innerText)
        .toLowerCase() ===
      "save"

    );


  if (!save) {

    const result = {

      node: NODE,

      success: false,

      state:
        "COMMIT_NOT_FOUND",

      job:
        d06.job,

      question:
        d06.question,

      answer:
        d06.answer,

      nextNode:
        "D10_EXCEPTION_INSPECTOR",

      error:
        ".sendMsg Save element not found"

    };

    window.ADAM_D07 =
      result;

    return result;
  }


  // ============================================================
  // HANDOFF CREATED BEFORE CLICK
  //
  // Important:
  // final answer may cause page navigation.
  // ============================================================

  const result = {

    node: NODE,

    success: true,

    timestamp:
      new Date().toISOString(),

    job:
      d06.job,

    state:
      "COMMIT_TRIGGERED",

    question:
      d06.question,

    answer:
      d06.answer,

    nextNode:
      "D08_APPLICATION_OUTCOME_INSPECTOR",

    error:
      null

  };


  // Same document
  window.ADAM_D07 =
    result;


  // Survives Naukri navigation
  sessionStorage.setItem(
    "ADAM_D07_HANDOFF",
    JSON.stringify(result)
  );


  console.log(
    "%cPROJECT ADAM — D07",
    "font-size:16px;font-weight:bold"
  );


  console.log(
    "🚀 Committing:",
    d06.answer.selected
  );


  console.log(
    "Next:",
    result.nextNode
  );


  // ============================================================
  // COMMIT
  // ============================================================

  save.click();


  return result;

};