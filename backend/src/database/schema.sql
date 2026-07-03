CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE,
    password_hash   VARCHAR(255),
    color           VARCHAR(9)  DEFAULT '#1976d2',
    role            VARCHAR(10) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    active          BOOLEAN     DEFAULT TRUE,
    created_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    failed_attempts INTEGER     DEFAULT 0,
    locked_at       TIMESTAMPTZ,
    token_version   INTEGER     DEFAULT 0
);

CREATE TABLE IF NOT EXISTS login_ip_attempts (
    ip           VARCHAR(64) PRIMARY KEY,
    count        INTEGER     NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) UNIQUE NOT NULL,
    color      VARCHAR(9)  DEFAULT '#9e9e9e',
    type       VARCHAR(10) CHECK (type IN ('INCOME', 'EXPENSE')) NOT NULL,
    active     BOOLEAN     DEFAULT TRUE,
    created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_methods (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    active      BOOLEAN      DEFAULT TRUE,
    closing_day INTEGER,
    due_day     INTEGER,
    card_limit  DECIMAL(10, 2)
);

CREATE TABLE IF NOT EXISTS assets (
    id           SERIAL PRIMARY KEY,
    ticker       VARCHAR(150) UNIQUE NOT NULL,
    type         VARCHAR(50)  DEFAULT 'Variável',
    manual_price DECIMAL(10, 2) DEFAULT NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id                   SERIAL PRIMARY KEY,
    description          TEXT           NOT NULL,
    amount               DECIMAL(10, 2) NOT NULL,
    type                 VARCHAR(10)    CHECK (type IN ('INCOME', 'EXPENSE')) NOT NULL,
    date                 DATE           DEFAULT CURRENT_DATE,
    user_id              INTEGER        REFERENCES users(id),
    category_id          INTEGER        REFERENCES categories(id),
    payment_method_id    INTEGER        REFERENCES payment_methods(id),
    asset_id             INTEGER        REFERENCES assets(id) ON DELETE SET NULL,
    quantity             DECIMAL(12, 4),
    installment_group_id UUID,
    investment_type      VARCHAR(50)    DEFAULT 'OUTROS'
        CHECK (investment_type IN ('RENDA_FIXA', 'ACOES', 'FII', 'CRIPTOS', 'INTERNACIONAL', 'OUTROS')),
    yield_rate           DECIMAL(10, 2),
    created_at           TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
    id          SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    amount      DECIMAL(10, 2) NOT NULL,
    period      VARCHAR(10) CHECK (period IN ('MONTHLY', 'YEARLY')) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, period)
);

CREATE TABLE IF NOT EXISTS families (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_members (
    family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
    user_id   INTEGER REFERENCES users(id)    ON DELETE CASCADE,
    PRIMARY KEY (family_id, user_id)
);

CREATE TABLE IF NOT EXISTS login_ip_attempts (
    ip           VARCHAR(64) PRIMARY KEY,
    count        INTEGER     NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id  ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON transactions(installment_group_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user   ON family_members(user_id);