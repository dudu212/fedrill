-- ============================================================
-- FEDrill 数据库建表脚本 (PostgreSQL 17)
-- 库名: fedrill   用户: ddd   密码: ddd
-- 6 张核心表 + 触发器 + 存储过程 + 索引
-- 满足 3NF
-- ============================================================

-- ------------------------------------------------------------
-- 1. users 用户表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    github_id   VARCHAR(64) UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.user_id IS '用户ID（主键，UUID 自动生成）';
COMMENT ON COLUMN users.email IS '邮箱（唯一）';
COMMENT ON COLUMN users.github_id IS 'GitHub OAuth ID（唯一，可空）';

-- ------------------------------------------------------------
-- 2. problems 题目表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problems (
    problem_id  VARCHAR(64) PRIMARY KEY,
    type        VARCHAR(20) NOT NULL
                CHECK (type IN ('implementation', 'algorithm', 'theory')),
    category    VARCHAR(20),
    title       VARCHAR(200) NOT NULL,
    difficulty  VARCHAR(10)
                CHECK (difficulty IN ('easy', 'medium', 'hard')),
    tags        TEXT[] NOT NULL DEFAULT '{}',
    data        JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE problems IS '题目表（静态题库）';
COMMENT ON COLUMN problems.problem_id IS '题目ID（如 impl-async-promise-all）';
COMMENT ON COLUMN problems.type IS '题型: implementation/algorithm/theory';
COMMENT ON COLUMN problems.data IS '题目完整数据（starterCode/testCases/edgeCases等，JSONB）';

-- ------------------------------------------------------------
-- 3. sessions 训练会话表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    session_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    problem_id            VARCHAR(64) NOT NULL REFERENCES problems(problem_id) ON DELETE CASCADE,
    current_round         SMALLINT NOT NULL DEFAULT 0
                          CHECK (current_round BETWEEN 0 AND 4),
    hints_used            INT NOT NULL DEFAULT 0,
    messages              JSONB NOT NULL DEFAULT '[]',
    code                  TEXT NOT NULL DEFAULT '',
    tested_code_snapshot  TEXT,
    last_test_results     JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, problem_id)
);

COMMENT ON TABLE sessions IS '训练会话表';
COMMENT ON COLUMN sessions.current_round IS '当前训练轮次 0-4（completed 落库为 4）';
COMMENT ON COLUMN sessions.messages IS '对话历史（JSONB 数组，SessionMessage[]）';
COMMENT ON COLUMN sessions.code IS '编辑器代码（SessionSnapshot.code）';
COMMENT ON COLUMN sessions.tested_code_snapshot IS '上次跑测试时的代码快照，用于陈旧检测';
COMMENT ON COLUMN sessions.last_test_results IS '最近一次测试结果（SandboxRunResult JSONB）';
COMMENT ON CONSTRAINT uq_sessions_user_problem ON sessions IS '每个用户每道题一条会话（upsert 语义）';

-- ------------------------------------------------------------
-- 4. test_results 测试结果表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_results (
    result_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    round           SMALLINT NOT NULL DEFAULT 0,
    passed_count    INT NOT NULL DEFAULT 0,
    total_count     INT NOT NULL DEFAULT 0,
    details         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE test_results IS '测试结果表';
COMMENT ON COLUMN test_results.details IS '每条用例的通过/失败详情（JSONB）';

-- ------------------------------------------------------------
-- 5. srs_cards 间隔重复卡片表 (SM-2)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS srs_cards (
    card_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    problem_id      VARCHAR(64) NOT NULL REFERENCES problems(problem_id) ON DELETE CASCADE,
    interval_days   INT NOT NULL DEFAULT 0,
    ease_factor     FLOAT NOT NULL DEFAULT 2.5,
    repetitions     INT NOT NULL DEFAULT 0,
    next_review     DATE NOT NULL DEFAULT CURRENT_DATE,
    last_quality    SMALLINT CHECK (last_quality BETWEEN 0 AND 5),
    UNIQUE (user_id, problem_id)
);

COMMENT ON TABLE srs_cards IS 'SM-2 间隔重复卡片表';
COMMENT ON COLUMN srs_cards.ease_factor IS 'SM-2 易度因子，默认 2.5';

-- ------------------------------------------------------------
-- 6. user_profiles 用户画像表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    skill_matrix     JSONB NOT NULL DEFAULT '{}',
    streak           INT NOT NULL DEFAULT 0,
    total_completed  INT NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_profiles IS '用户能力画像表（与用户一对一）';

-- ------------------------------------------------------------
-- 7. 索引设计
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sessions_user      ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_problem   ON sessions(problem_id);
CREATE INDEX IF NOT EXISTS idx_test_results_session ON test_results(session_id);
CREATE INDEX IF NOT EXISTS idx_srs_cards_user     ON srs_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_srs_cards_problem  ON srs_cards(problem_id);
CREATE INDEX IF NOT EXISTS idx_srs_cards_next_review ON srs_cards(next_review);
CREATE INDEX IF NOT EXISTS idx_problems_type      ON problems(type);

-- ------------------------------------------------------------
-- 8. 触发器：updated_at 自动维护
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sessions_updated ON sessions;
CREATE TRIGGER trg_sessions_updated
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_problems_updated ON problems;
CREATE TRIGGER trg_problems_updated
    BEFORE UPDATE ON problems
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_profiles_updated ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 9. 存储过程：训练完成后更新用户画像
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_user_profile(p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE user_profiles
    SET total_completed = (
            SELECT COUNT(*) FROM sessions
            WHERE user_id = p_user_id AND current_round = 4
        ),
        updated_at = now()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_user_profile(UUID) IS '训练完成（到达Round 4）后刷新用户完成数';
