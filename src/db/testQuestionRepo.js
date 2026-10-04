const {
  DB_PATH,
  collectFromApplyResponse,
  getQuestionCount,
  getOccurrenceCount,
  getTopQuestions
} = require("./questionRepo");


const fakeApplyResponse = {

  statusCode: 0,

  jobs: [

    {

      jobId:
        "TEST001",

      companyName:
        "Project Adam Test",

      jobTitle:
        "Business Analyst",

      questionnaire: [

        {

          questionId:
            "Q001",

          questionName:
            "What is your current CTC in Lacs per annum?",

          questionType:
            "Text Box",

          isMandatory:
            true,

          category:
            "CURRENT_CTC",

          prefillData:
            ["450000"],

          answerOption:
            {},

          questionnaireId:
            123,

          questionnaireType:
            "DEFAULT",

          answerOptionsMetadata:
            {}

        },

        {

          questionId:
            "Q002",

          questionName:
            "What is your notice period?",

          questionType:
            "Radio Button",

          isMandatory:
            true,

          category:
            "NOTICE_PERIOD",

          prefillData:
            ["1 Month"],

          answerOption: {

            0:
              "15 Days or less",

            1:
              "1 Month"

          },

          questionnaireId:
            123,

          questionnaireType:
            "DEFAULT",

          answerOptionsMetadata:
            {}

        }

      ]

    }

  ],

  skippableQuestions: [
    "Q001",
    "Q002"
  ],

  flowType:
    "default"

};


const result =
  collectFromApplyResponse(
    fakeApplyResponse
  );


console.log(
  "\nDB:",
  DB_PATH
);


console.log(
  "\nCOLLECTION RESULT:"
);


console.log(
  result
);


console.log(
  "\nUNIQUE QUESTIONS:",
  getQuestionCount()
);


console.log(
  "OCCURRENCES:",
  getOccurrenceCount()
);


console.log(
  "\nTOP QUESTIONS:"
);


console.table(
  getTopQuestions(20)
);
