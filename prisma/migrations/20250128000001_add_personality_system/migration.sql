-- Add personality scoring to Profile table
ALTER TABLE "profiles" ADD COLUMN "extroversion" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "openness" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "conscientiousness" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "agreeableness" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "emotional_stability" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "growth_mindset" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "collectivism" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "spiritual_inclination" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "veganism_support" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "environmental_consciousness" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "health_focus" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "social_justice" DECIMAL(3,2);
ALTER TABLE "profiles" ADD COLUMN "personality_quiz_completed" BOOLEAN DEFAULT FALSE;
ALTER TABLE "profiles" ADD COLUMN "personality_quiz_completed_at" TIMESTAMP;

-- Create PersonalityQuestion table
CREATE TABLE "personality_questions" (
  "id" TEXT NOT NULL,
  "question_number" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "question_text" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "scoring_weights" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "personality_questions_pkey" PRIMARY KEY ("id")
);

-- Create PersonalityAnswer table
CREATE TABLE "personality_answers" (
  "id" TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "selected_option" TEXT NOT NULL,
  "option_index" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "personality_answers_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for profile + question
ALTER TABLE "personality_answers" ADD CONSTRAINT "personality_answers_profile_id_question_id_key" UNIQUE ("profile_id", "question_id");

-- Add foreign key constraints
ALTER TABLE "personality_answers" ADD CONSTRAINT "personality_answers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personality_answers" ADD CONSTRAINT "personality_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "personality_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indices for better performance
CREATE INDEX "personality_questions_question_number_idx" ON "personality_questions"("question_number");
CREATE INDEX "personality_answers_profile_id_idx" ON "personality_answers"("profile_id");
CREATE INDEX "personality_answers_question_id_idx" ON "personality_answers"("question_id");

-- Create compatibility scores table for caching
CREATE TABLE "compatibility_scores" (
  "id" TEXT NOT NULL,
  "user1_id" TEXT NOT NULL,
  "user2_id" TEXT NOT NULL,
  "overall_score" DECIMAL(5,2) NOT NULL,
  "personality_score" DECIMAL(5,2) NOT NULL,
  "lifestyle_score" DECIMAL(5,2) NOT NULL,
  "trait_scores" JSONB NOT NULL,
  "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "compatibility_scores_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint and foreign keys for compatibility scores
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_user1_id_user2_id_key" UNIQUE ("user1_id", "user2_id");
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indices for compatibility scores
CREATE INDEX "compatibility_scores_user1_id_idx" ON "compatibility_scores"("user1_id");
CREATE INDEX "compatibility_scores_user2_id_idx" ON "compatibility_scores"("user2_id");
CREATE INDEX "compatibility_scores_overall_score_idx" ON "compatibility_scores"("overall_score");
CREATE INDEX "compatibility_scores_expires_at_idx" ON "compatibility_scores"("expires_at");