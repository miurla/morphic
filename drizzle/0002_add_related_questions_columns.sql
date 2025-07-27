-- Add columns for relatedQuestions tool
ALTER TABLE parts ADD COLUMN tool_related_questions_input json;
ALTER TABLE parts ADD COLUMN tool_related_questions_output json;