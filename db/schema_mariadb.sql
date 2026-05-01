-- MariaDB schema for careers app (votes only)
-- Run via: node scripts/load_schema.js

CREATE DATABASE IF NOT EXISTS careers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE careers;

CREATE TABLE IF NOT EXISTS votes (
	id              BIGINT      NOT NULL AUTO_INCREMENT,
	role_id         VARCHAR(50) NOT NULL,
	pathway_id      VARCHAR(20) NOT NULL,
	level           TINYINT     NOT NULL,
	skill_id        VARCHAR(20) NOT NULL,
	suggested_level TINYINT     NOT NULL,
	voter_token     VARCHAR(36)  NOT NULL,
	ip_address      VARCHAR(45)  NULL,
	created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY votes_unique_voter (role_id, pathway_id, level, skill_id, voter_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skill_presence_votes (
	id              BIGINT       NOT NULL AUTO_INCREMENT,
	role_id         VARCHAR(50)  NOT NULL,
	pathway_id      VARCHAR(20)  NOT NULL,
	level           TINYINT      NOT NULL,
	skill_id        VARCHAR(20)  NOT NULL,
	vote_type       ENUM('add','remove') NOT NULL,
	suggested_level TINYINT      NULL,
	voter_token     VARCHAR(36)  NOT NULL,
	ip_address      VARCHAR(45)  NULL,
	created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY presence_unique_voter (role_id, pathway_id, level, skill_id, voter_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
