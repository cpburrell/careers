-- Add ip_address column to both vote tables
ALTER TABLE votes
    ADD COLUMN ip_address VARCHAR(45) NULL AFTER voter_token;

ALTER TABLE skill_presence_votes
    ADD COLUMN ip_address VARCHAR(45) NULL AFTER voter_token;
