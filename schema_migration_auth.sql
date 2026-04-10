  USE sirius;

ALTER TABLE users
  ADD COLUMN email VARCHAR(512) NULL DEFAULT NULL AFTER pseudo,
  ADD COLUMN password_hash VARCHAR(255) NULL DEFAULT NULL AFTER email;

CREATE UNIQUE INDEX uq_users_email ON users (email);
