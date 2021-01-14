CREATE TABLE IF NOT EXISTS `ylyc`.`user` (
  `user_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(254) NULL,
  `rewards_pts` INT DEFAULT 0,
  `password` VARCHAR(64) NOT NULL,
  `notification` BOOLEAN NOT NULL DEFAULT FALSE,
  `notification_token` VARCHAR(255) NULL,
  PRIMARY KEY (`user_id`));
  
CREATE TABLE IF NOT EXISTS `ylyc`.`reminder_type` (
  `id` INT NOT NULL,
  `title` VARCHAR(64) NOT NULL,
  `image` VARCHAR(255) NOT NULL,
  `message` VARCHAR(255) NOT NULL,
  `rewards_pts` INT DEFAULT 0,
  PRIMARY KEY (`id`));
  
CREATE TABLE IF NOT EXISTS `ylyc`.`reminders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reminder_type_id` INT NOT NULL,
  `title` VARCHAR(64) NOT NULL,
  `image` VARCHAR(255) NOT NULL,
  `s3_image_key` VARCHAR(255) DEFAULT NULL,
  `message` VARCHAR(255) NOT NULL,
  `reminder_date` TIMESTAMP,
  `user_id` VARCHAR(64) NOT NULL,
  `status` INT DEFAULT 0,
  `rewards_pts` INT DEFAULT 0,
  `completed_date` TIMESTAMP NULL,
  `created_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`));

  CREATE TABLE IF NOT EXISTS `ylyc`.`meals` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reminder_type_id` INT NOT NULL,
  `image` VARCHAR(255) NOT NULL,
  `message` VARCHAR(255) NOT NULL,
  `created_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`));