-- Phase 7: cloze question type (R6.1; design §4.1)

alter table public.review_logs
  drop constraint review_logs_question_type_check,
  add constraint review_logs_question_type_check
    check (question_type in ('word_to_zh','word_to_synonym','word_to_antonym','zh_to_word','cloze'));

alter table public.ai_distractors
  drop constraint ai_distractors_question_type_check,
  add constraint ai_distractors_question_type_check
    check (question_type in ('word_to_zh','word_to_synonym','word_to_antonym','zh_to_word','cloze'));
