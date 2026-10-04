const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");


// ============================================================
// PROJECT ADAM — QUESTION REPOSITORY
// ============================================================

const DB_PATH =
  path.resolve(
    process.env.QUESTION_DB_PATH ||
    "./data/adam_questions.db"
  );


fs.mkdirSync(
  path.dirname(DB_PATH),
  {
    recursive: true
  }
);


const db =
  new Database(DB_PATH);


db.pragma(
  "journal_mode = WAL"
);

db.pragma(
  "foreign_keys = ON"
);

db.pragma(
  "busy_timeout = 5000"
);


// ============================================================
// SCHEMA
// ============================================================

db.exec(`

CREATE TABLE IF NOT EXISTS questions (

    question_key TEXT PRIMARY KEY,

    representative_text TEXT NOT NULL,

    normalized_text TEXT NOT NULL,

    question_type TEXT,

    category TEXT,

    canonical_intent TEXT,

    mandatory INTEGER,

    options_json TEXT,

    answer_options_metadata_json TEXT,

    seen_count INTEGER NOT NULL DEFAULT 0,

    first_seen_at TEXT NOT NULL,

    last_seen_at TEXT NOT NULL

);


CREATE INDEX IF NOT EXISTS idx_questions_text
ON questions(normalized_text);


CREATE INDEX IF NOT EXISTS idx_questions_category
ON questions(category);


CREATE INDEX IF NOT EXISTS idx_questions_type
ON questions(question_type);


CREATE INDEX IF NOT EXISTS idx_questions_seen
ON questions(seen_count DESC);



CREATE TABLE IF NOT EXISTS question_occurrences (

    occurrence_id INTEGER PRIMARY KEY AUTOINCREMENT,

    question_key TEXT NOT NULL,

    job_id TEXT,

    job_title TEXT,

    company_name TEXT,

    source_question_id TEXT,

    questionnaire_id TEXT,

    questionnaire_type TEXT,

    prefill_json TEXT,

    skippable INTEGER DEFAULT 0,

    captured_at TEXT NOT NULL,

    UNIQUE(
        job_id,
        source_question_id
    )

);


CREATE INDEX IF NOT EXISTS idx_occurrences_question
ON question_occurrences(question_key);


CREATE INDEX IF NOT EXISTS idx_occurrences_job
ON question_occurrences(job_id);



CREATE TABLE IF NOT EXISTS apply_captures (

    capture_id INTEGER PRIMARY KEY AUTOINCREMENT,

    job_id TEXT,

    job_title TEXT,

    company_name TEXT,

    captured_at TEXT NOT NULL,

    question_count INTEGER DEFAULT 0,

    flow_type TEXT,

    apply_status_json TEXT,

    raw_json TEXT NOT NULL

);


CREATE TABLE IF NOT EXISTS known_answers (

    canonical_intent TEXT PRIMARY KEY,

    answer_type TEXT,

    answer_value TEXT,

    answer_source TEXT,

    confidence TEXT,

    updated_at TEXT NOT NULL

);

`);


// ============================================================
// HELPERS
// ============================================================

function clean(value) {

  return String(
    value ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();

}


function normalizeQuestion(
  text
) {

  return clean(text)
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(
      /[^a-z0-9.+%\- ]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

}


function makeQuestionKey(
  text,
  type
) {

  const source =

    normalizeQuestion(text)

    + "|"

    + clean(type)
        .toLowerCase();


  return crypto
    .createHash("sha256")
    .update(source)
    .digest("hex")
    .slice(0, 24);

}


function now() {

  return new Date()
    .toISOString();

}


// ============================================================
// STATEMENTS
// ============================================================

const findQuestion =
  db.prepare(`

    SELECT *
    FROM questions
    WHERE question_key = ?

  `);


const insertQuestion =
  db.prepare(`

    INSERT INTO questions (

        question_key,
        representative_text,
        normalized_text,
        question_type,
        category,
        canonical_intent,
        mandatory,
        options_json,
        answer_options_metadata_json,
        seen_count,
        first_seen_at,
        last_seen_at

    )

    VALUES (
        ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, ?, ?
    )

    ON CONFLICT(question_key)

    DO UPDATE SET

        category =
          COALESCE(
            questions.category,
            excluded.category
          ),

        mandatory =
          excluded.mandatory,

        options_json =
          excluded.options_json,

        answer_options_metadata_json =
          excluded.answer_options_metadata_json,

        last_seen_at =
          excluded.last_seen_at

  `);


const insertOccurrence =
  db.prepare(`

    INSERT OR IGNORE INTO
    question_occurrences (

        question_key,
        job_id,
        job_title,
        company_name,
        source_question_id,
        questionnaire_id,
        questionnaire_type,
        prefill_json,
        skippable,
        captured_at

    )

    VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )

  `);


const incrementQuestion =
  db.prepare(`

    UPDATE questions

    SET

      seen_count =
        seen_count + 1,

      last_seen_at = ?

    WHERE question_key = ?

  `);


const insertCapture =
  db.prepare(`

    INSERT INTO apply_captures (

        job_id,
        job_title,
        company_name,
        captured_at,
        question_count,
        flow_type,
        apply_status_json,
        raw_json

    )

    VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?
    )

  `);


// ============================================================
// CAPTURE APPLY WORKFLOW RESPONSE
// ============================================================

const collectFromApplyResponse =
  db.transaction(
    (
      payload,
      meta = {}
    ) => {

      if (
        !payload ||
        typeof payload !== "object"
      ) {

        return {

          success: false,

          reason:
            "INVALID_PAYLOAD",

          questionsFound:
            0,

          uniqueAdded:
            0

        };

      }


      const capturedAt =
        now();


      const jobs =
        Array.isArray(
          payload.jobs
        )

          ? payload.jobs

          : [];


      const skippableQuestions =
        new Set(

          (
            payload.skippableQuestions ||
            []
          ).map(String)

        );


      let questionsFound =
        0;


      let uniqueAdded =
        0;


      const collectedQuestions =
        [];


      for (
        const job
        of jobs
      ) {

        const jobId =
          String(
            job.jobId ||
            meta.jobId ||
            ""
          );


        const jobTitle =
          clean(
            job.jobTitle ||
            meta.jobTitle
          );


        const companyName =
          clean(
            job.companyName ||
            meta.companyName
          );


        const questionnaire =
          Array.isArray(
            job.questionnaire
          )

            ? job.questionnaire

            : [];


        for (
          const question
          of questionnaire
        ) {

          const questionText =
            clean(
              question.questionName
            );


          if (!questionText)
            continue;


          questionsFound++;


          const questionType =
            clean(
              question.questionType
            );


          const questionKey =
            makeQuestionKey(
              questionText,
              questionType
            );


          const existed =
            !!findQuestion.get(
              questionKey
            );


          insertQuestion.run(

            questionKey,

            questionText,

            normalizeQuestion(
              questionText
            ),

            questionType ||
              null,

            question.category ||
              null,

            question.isMandatory
              ? 1
              : 0,

            JSON.stringify(
              question.answerOption ||
              {}
            ),

            JSON.stringify(
              question.answerOptionsMetadata ||
              {}
            ),

            capturedAt,

            capturedAt

          );


          if (!existed) {

            uniqueAdded++;

          }


          let prefill =
            question.prefillData ??
            null;


          const sourceQuestionId =
            String(
              question.questionId ||
              ""
            );


          const occurrence =
            insertOccurrence.run(

              questionKey,

              jobId ||
                null,

              jobTitle ||
                null,

              companyName ||
                null,

              sourceQuestionId ||
                null,

              question.questionnaireId
                ? String(
                    question.questionnaireId
                  )
                : null,

              question.questionnaireType ||
                null,

              prefill !== null
                ? JSON.stringify(
                    prefill
                  )
                : null,

              skippableQuestions.has(
                sourceQuestionId
              )
                ? 1
                : 0,

              capturedAt

          );


          if (
            occurrence.changes === 1
          ) {

            incrementQuestion.run(

              capturedAt,

              questionKey

            );

          }


          collectedQuestions.push({

            questionKey,

            questionId:
              sourceQuestionId,

            question:
              questionText,

            type:
              questionType,

            category:
              question.category ||
              null,

            mandatory:
              !!question.isMandatory,

            prefill,

            options:
              question.answerOption ||
              {}

          });

        }


        insertCapture.run(

          jobId ||
            null,

          jobTitle ||
            null,

          companyName ||
            null,

          capturedAt,

          questionnaire.length,

          payload.flowType ||
            null,

          JSON.stringify(
            payload.applyStatus ||
            {}
          ),

          JSON.stringify(
            payload
          )

        );

      }


      return {

        success:
          true,

        questionsFound,

        uniqueAdded,

        collectedQuestions

      };

    }
  );


// ============================================================
// QUERY HELPERS
// ============================================================

function getQuestionCount() {

  return db
    .prepare(`

      SELECT COUNT(*) AS count
      FROM questions

    `)
    .get()
    .count;

}


function getOccurrenceCount() {

  return db
    .prepare(`

      SELECT COUNT(*) AS count
      FROM question_occurrences

    `)
    .get()
    .count;

}


function getTopQuestions(
  limit = 20
) {

  return db
    .prepare(`

      SELECT

        representative_text,
        question_type,
        category,
        canonical_intent,
        seen_count

      FROM questions

      ORDER BY
        seen_count DESC,
        representative_text ASC

      LIMIT ?

    `)
    .all(limit);

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  db,

  DB_PATH,

  collectFromApplyResponse,

  normalizeQuestion,

  makeQuestionKey,

  getQuestionCount,

  getOccurrenceCount,

  getTopQuestions

};
