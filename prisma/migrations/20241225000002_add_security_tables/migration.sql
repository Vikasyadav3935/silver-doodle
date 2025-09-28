-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "event_type" TEXT NOT NULL,
    "user_id" TEXT,
    "target_user_id" TEXT,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "details" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "blacklisted_tokens" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklisted_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "blacklisted_tokens_token_hash_key" ON "blacklisted_tokens"("token_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "blacklisted_tokens_user_id_idx" ON "blacklisted_tokens"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "blacklisted_tokens_expires_at_idx" ON "blacklisted_tokens"("expires_at");

-- AddForeignKey (only if users table exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'audit_logs_user_id_fkey') THEN
            ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'audit_logs_target_user_id_fkey') THEN
            ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'user_roles_user_id_fkey') THEN
            ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'user_roles_granted_by_fkey') THEN
            ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'blacklisted_tokens_user_id_fkey') THEN
            ALTER TABLE "blacklisted_tokens" ADD CONSTRAINT "blacklisted_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;