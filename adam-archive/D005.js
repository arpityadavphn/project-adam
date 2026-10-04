(() => {

  const NODE = "D05_QUESTION_INSPECTOR";

  const clean = s =>
    (s || "").replace(/\s+/g, " ").trim();

  const visible = el => {
    if (!el) return false;

    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();

    return (
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      r.width > 0 &&
      r.height > 0
    );
  };

  const textOf = el =>
    clean(el?.innerText || el?.textContent || "");


  // ============================================================
  // 1. INPUT
  //
  // First question  : D04
  // Next questions : D08
  // ============================================================

  const d04 =
    window.ADAM_D04 || null;

  const d08 =
    window.ADAM_D08 || null;


  let previous = null;


  if (
    d08 &&
    d08.state === "QUESTIONS_PRESENT"
  ) {
    previous = d08;
  }

  else if (
    d04 &&
    d04.state === "QUESTIONS_PRESENT"
  ) {
    previous = d04;
  }


  if (!previous) {

    const result = {

      node: NODE,

      success: false,

      state: "INVALID_INPUT_STATE",

      reason:
        "D05 requires QUESTIONS_PRESENT from D04 or D08",

      nextNode: null,

      error:
        "No valid upstream questionnaire state"

    };

    window.ADAM_D05 = result;

    console.error(
      "❌ D05 invalid input"
    );

    return result;
  }


  // ============================================================
  // 2. APPLICATION ROOT
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
        previous.job || null,

      nextNode:
        "D10_EXCEPTION_INSPECTOR",

      error:
        "Naukri application drawer not found"

    };

    window.ADAM_D05 = result;

    return result;
  }


  // ============================================================
  // 3. CURRENT CONTROLS
  // ============================================================

  const radios = [
    ...root.querySelectorAll(
      'input[type="radio"]'
    )
  ].filter(visible);


  const checkboxes = [
    ...root.querySelectorAll(
      'input[type="checkbox"]'
    )
  ].filter(visible);


  const selects = [
    ...root.querySelectorAll(
      "select"
    )
  ].filter(visible);


  const textInputs = [
    ...root.querySelectorAll(
      `
      input[type="text"],
      input[type="number"],
      input[type="email"],
      textarea
      `
    )
  ].filter(visible);


  let type = "UNKNOWN";
  let controls = [];


  if (radios.length) {

    type = "RADIO_SINGLE";

    const group =
      radios[0].name;

    controls =
      group
        ? radios.filter(
            r => r.name === group
          )
        : radios;

  }

  else if (checkboxes.length) {

    type = "CHECKBOX_MULTI";
    controls = checkboxes;

  }

  else if (selects.length) {

    type = "SELECT_SINGLE";
    controls = [selects[0]];

  }

  else if (textInputs.length) {

    type =
      textInputs[0].type === "number"
        ? "NUMBER"
        : "TEXT";

    controls =
      [textInputs[0]];

  }


  if (!controls.length) {

    const result = {

      node: NODE,

      success: false,

      state:
        "QUESTION_CONTROLS_NOT_FOUND",

      job:
        previous.job || null,

      nextNode:
        "D08_APPLICATION_OUTCOME_INSPECTOR",

      error:
        "No visible question controls"

    };

    window.ADAM_D05 = result;

    return result;
  }


  // ============================================================
  // 4. OPTION LABEL
  // ============================================================

  function getLabel(control) {

    if (control.id) {

      const explicit =
        root.querySelector(
          `label[for="${CSS.escape(control.id)}"]`
        );

      if (
        explicit &&
        visible(explicit)
      ) {

        const text =
          textOf(explicit);

        if (text)
          return text;
      }
    }


    const wrapped =
      control.closest("label");


    if (
      wrapped &&
      visible(wrapped)
    ) {

      const text =
        textOf(wrapped);

      if (text)
        return text;
    }


    let parent =
      control.parentElement;


    for (
      let i = 0;
      i < 4 && parent;
      i++
    ) {

      const text =
        textOf(parent);

      if (
        text &&
        text.length <= 100
      ) {
        return text;
      }

      parent =
        parent.parentElement;
    }


    return control.value || "";
  }


  // ============================================================
  // 5. OPTIONS
  // ============================================================

  let options = [];


  if (
    type === "RADIO_SINGLE" ||
    type === "CHECKBOX_MULTI"
  ) {

    options =
      controls.map(
        (control, index) => ({

          index,

          text:
            getLabel(control),

          value:
            control.value || null,

          checked:
            control.checked === true

        })
      );

  }


  else if (
    type === "SELECT_SINGLE"
  ) {

    options =
      [...controls[0].options]
        .map(
          (option, index) => ({

            index,

            text:
              clean(option.textContent),

            value:
              option.value,

            selected:
              option.selected

          })
        );

  }


  // ============================================================
  // 6. QUESTION TEXT
  // ============================================================

  const firstControl =
    controls[0];


  const controlRect =
    firstControl.getBoundingClientRect();


  let candidates = [

    ...root.querySelectorAll(
      `
      p,
      span,
      div,
      label,
      h1,
      h2,
      h3,
      h4
      `
    )

  ]
    .filter(visible)

    .map(el => {

      const rect =
        el.getBoundingClientRect();

      return {

        text:
          textOf(el),

        gap:
          controlRect.top -
          rect.bottom

      };

    })

    .filter(x => {

      if (
        !x.text ||
        x.text.length < 5 ||
        x.text.length > 300
      ) {
        return false;
      }


      if (
        x.gap < -10 ||
        x.gap > 350
      ) {
        return false;
      }


      const lower =
        x.text.toLowerCase();


      if (
        lower === "yes" ||
        lower === "no" ||
        lower === "save" ||
        lower === "try again" ||
        lower.includes(
          "thank you for showing interest"
        ) ||
        lower.includes(
          "kindly answer all the recruiter's questions"
        )
      ) {
        return false;
      }


      return true;

    });


  candidates =
    candidates.map(x => {

      let score = 0;


      if (x.text.includes("?"))
        score += 1000;


      score +=
        Math.max(
          0,
          300 - Math.abs(x.gap)
        );


      if (x.text.length < 150)
        score += 100;


      return {
        ...x,
        score
      };

    });


  candidates.sort(
    (a, b) =>
      b.score - a.score
  );


  const question =
    candidates[0]?.text || "";


  // ============================================================
  // 7. RESULT
  // ============================================================

  const result = {

    node: NODE,

    success:
      !!question &&
      type !== "UNKNOWN",

    timestamp:
      new Date().toISOString(),

    job:
      previous.job || null,

    state:
      "QUESTION_IDENTIFIED",

    question: {

      text:
        question,

      type,

      options,

      controlCount:
        controls.length,

      confidence:
        question.includes("?")
          ? "HIGH"
          : "MEDIUM"

    },

    nextNode:
      "D06_ANSWER_ACTOR",

    error:
      !question
        ? "Question text not identified"
        : null

  };


  window.ADAM_D05 =
    result;


  console.log(
    "%cPROJECT ADAM — D05",
    "font-size:16px;font-weight:bold"
  );


  console.log(
    "Question:",
    question
  );


  console.log(
    "Type:",
    type
  );


  if (options.length)
    console.table(options);


  console.log(
    "Next:",
    result.nextNode
  );


  console.log(
    "Full result:",
    result
  );


  return result;

})();