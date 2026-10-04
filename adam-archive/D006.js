window.ADAM_RUN_D06 =
async function(ANSWER) {

  const NODE =
    "D06_ANSWER_ACTOR";


  const sleep = ms =>
    new Promise(resolve =>
      setTimeout(resolve, ms)
    );


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

  const d05 =
    window.ADAM_D05;


  if (
    !d05 ||
    d05.state !==
      "QUESTION_IDENTIFIED"
  ) {

    const result = {

      node: NODE,

      success: false,

      state:
        "INVALID_INPUT_STATE",

      reason:
        "D06 requires D05 QUESTION_IDENTIFIED",

      nextNode:
        "D05_QUESTION_INSPECTOR"

    };

    window.ADAM_D06 =
      result;

    return result;
  }


  // ============================================================
  // QUESTION TYPE
  // ============================================================

  if (
    d05.question.type !==
      "RADIO_SINGLE"
  ) {

    const result = {

      node: NODE,

      success: false,

      state:
        "QUESTION_TYPE_NOT_CERTIFIED",

      job:
        d05.job,

      question:
        d05.question,

      nextNode:
        "D10_EXCEPTION_INSPECTOR",

      error:
        `Unsupported type: ${d05.question.type}`

    };

    window.ADAM_D06 =
      result;

    return result;
  }


  // ============================================================
  // APPLICATION ROOT
  // ============================================================

  const root =

    document.querySelector(
      "._chatBotContainer"
    )

    ||

    document.querySelector(
      ".chatbot_Drawer.chatbot_right"
    )

    ||

    document.querySelector(
      ".chatbot_Drawer"
    );


  if (!root) {

    const result = {

      node: NODE,

      success: false,

      state:
        "APPLICATION_DRAWER_NOT_FOUND",

      job:
        d05.job,

      nextNode:
        "D10_EXCEPTION_INSPECTOR"

    };

    window.ADAM_D06 =
      result;

    return result;
  }


  // ============================================================
  // CURRENT RADIO GROUP
  // ============================================================

  let radios = [

    ...root.querySelectorAll(
      'input[type="radio"]'
    )

  ].filter(visible);


  if (!radios.length) {

    const result = {

      node: NODE,

      success: false,

      state:
        "ANSWER_CONTROLS_NOT_FOUND",

      job:
        d05.job,

      nextNode:
        "D05_QUESTION_INSPECTOR"

    };

    window.ADAM_D06 =
      result;

    return result;
  }


  const groupName =
    radios[0].name;


  if (groupName) {

    radios =
      radios.filter(
        radio =>
          radio.name === groupName
      );

  }


  // ============================================================
  // MATCH REQUESTED ANSWER
  // ============================================================

  const requested =
    clean(ANSWER)
      .toLowerCase();


  const optionIndex =
    d05.question.options
      .findIndex(option =>

        clean(option.text)
          .toLowerCase() ===
          requested

        ||

        clean(option.value)
          .toLowerCase() ===
          requested

      );


  if (optionIndex === -1) {

    const result = {

      node: NODE,

      success: false,

      state:
        "ANSWER_NOT_MATCHED",

      job:
        d05.job,

      question:
        d05.question,

      answer: {
        requested:
          ANSWER
      },

      availableOptions:
        d05.question.options
          .map(x => x.text),

      nextNode:
        "ANSWER_RESOLVER"

    };

    window.ADAM_D06 =
      result;

    return result;
  }


  const target =
    radios[optionIndex];


  // ============================================================
  // SELECT
  // ============================================================

  target.click();


  await sleep(350);


  if (!target.checked) {

    const fallback =

      (
        target.id

          ? root.querySelector(
              `label[for="${CSS.escape(target.id)}"]`
            )

          : null
      )

      ||

      target.closest("label")

      ||

      target.parentElement;


    fallback?.click();


    await sleep(350);

  }


  const verified =
    target.checked === true;


  // ============================================================
  // RESULT
  // ============================================================

  const result = {

    node: NODE,

    success:
      verified,

    timestamp:
      new Date().toISOString(),

    job:
      d05.job,

    state:
      verified
        ? "ANSWER_SELECTED"
        : "ANSWER_SELECTION_FAILED",

    question:
      d05.question,

    answer: {

      requested:
        ANSWER,

      selected:
        d05.question.options[
          optionIndex
        ]?.text,

      optionIndex,

      verified

    },

    nextNode:
      verified
        ? "D07_COMMIT_ANSWER"
        : "D10_EXCEPTION_INSPECTOR",

    error:
      verified
        ? null
        : "Answer did not register"

  };


  window.ADAM_D06 =
    result;


  console.log(
    "%cPROJECT ADAM — D06",
    "font-size:16px;font-weight:bold"
  );


  console.log(
    verified
      ? "✅ ANSWER SELECTED"
      : "❌ ANSWER FAILED"
  );


  console.log(
    "Answer:",
    result.answer.selected
  );


  console.log(
    "Next:",
    result.nextNode
  );


  console.log(result);


  return result;

};