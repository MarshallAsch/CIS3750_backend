

# Create the user to access the database for node
CREATE USER IF NOT EXISTS '{{USERNAME}}'@'localhost' IDENTIFIED BY '{{PASSWORD}}';

CREATE DATABASE IF NOT EXISTS `{{DATABASE}}` CHARACTER SET = utf8 COLLATE = utf8_general_ci;

# do not add additional privileges since this is all the access that the node.js API needs.
GRANT DELETE, INSERT, SELECT, UPDATE ON `{{DATABASE}}`.* TO '{{USERNAME}}'@'localhost';

USE `{{DATABASE}}`;

# The rest of the commands are to create the tables they does not yet exist

CREATE TABLE IF NOT EXISTS `Users` (
	`ID` int NOT NULL AUTO_INCREMENT UNIQUE,
	`enabled` bool NOT NULL,
	`supportWorker` bool NOT NULL,
	`admin` bool NOT NULL,
	`birthday` DATE NOT NULL,
	`createTime` DATETIME NOT NULL,
	`firstname` varchar(60) NOT NULL,
	`lastname` varchar(60) NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`phoneNumber` varchar(17) NOT NULL,
	`email` varchar(256) NOT NULL UNIQUE,
	`recoveryQ1` TEXT NOT NULL,
	`recoveryA1` TEXT NOT NULL,
	`recoveryQ2` TEXT NOT NULL,
	`recoveryA2` TEXT NOT NULL,
	`profilePictureFile` varchar(256) DEFAULT 'images/defaultProfilePhoto.png',
	PRIMARY KEY (`ID`)
) ENGINE=INNODB;

CREATE TABLE IF NOT EXISTS `clientMappings` (
	`client` int NOT NULL,
	`supportWorker` int NOT NULL,
	PRIMARY KEY (`client`,`supportWorker`),
	CONSTRAINT `clientMappings_fk0` FOREIGN KEY (`client`) REFERENCES `Users`(`ID`),
	CONSTRAINT `clientMappings_fk1` FOREIGN KEY (`supportWorker`) REFERENCES `Users`(`ID`)
) ENGINE=INNODB;

CREATE TABLE IF NOT EXISTS `Drug` (
	`ID` int NOT NULL AUTO_INCREMENT UNIQUE,
	`name` TEXT NOT NULL,
	PRIMARY KEY (`ID`)
) ENGINE=INNODB;


CREATE TABLE IF NOT EXISTS `schedule` (
	`ID` int NOT NULL AUTO_INCREMENT,
	`client` int NOT NULL,
	`drug` int NOT NULL,
	`dose unit` int NOT NULL,
	`dose` FLOAT NOT NULL,
	`createdByStaff` bool NOT NULL,
	`enabled` bool NOT NULL,
	`vacationUntil` DATE,
	`createDate` DATETIME NOT NULL,
	`endDate` DATE NOT NULL,
	PRIMARY KEY (`ID`),
	CONSTRAINT `schedule_fk0` FOREIGN KEY (`client`) REFERENCES `Users`(`ID`),
	CONSTRAINT `schedule_fk1` FOREIGN KEY (`drug`) REFERENCES `Drug`(`ID`)
) ENGINE=INNODB;


CREATE TABLE IF NOT EXISTS `dose` (
	`scheduleID` int NOT NULL,
	`doseID` int NOT NULL AUTO_INCREMENT,
	`day` int NOT NULL,
	`time` TIME NOT NULL,
	`notificationTime` TIME NOT NULL,
	`doseWindow` TIME NOT NULL,
	PRIMARY KEY (`doseID`),
	CONSTRAINT `dose_fk0` FOREIGN KEY (`scheduleID`) REFERENCES `schedule`(`ID`)
) ENGINE=INNODB;

CREATE TABLE IF NOT EXISTS `schedulePermissions` (
	`scheduleID` int NOT NULL,
	`userID` int NOT NULL,
	`clientID` int NOT NULL,
	`userAccepted` bool NOT NULL DEFAULT  FALSE,
	`mandatory` bool NOT NULL DEFAULT FALSE,
	PRIMARY KEY (`scheduleID`,`userID`,`clientID`),
	CONSTRAINT `schedulePermissions_fk0` FOREIGN KEY (`scheduleID`) REFERENCES `schedule`(`ID`),
	CONSTRAINT `schedulePermissions_fk1` FOREIGN KEY (`userID`) REFERENCES `Users`(`ID`),
	CONSTRAINT `schedulePermissions_fk2` FOREIGN KEY (`clientID`) REFERENCES `Users`(`ID`)
) ENGINE=INNODB;

CREATE TABLE IF NOT EXISTS `doseTaken` (
	`scheduleID` int NOT NULL,
	`doseID` int NOT NULL,
	`time` DATETIME NOT NULL,
	`status` int NOT NULL,
	PRIMARY KEY (`scheduleID`,`doseID`,`time`),
	CONSTRAINT `doseTaken_fk0` FOREIGN KEY (`scheduleID`) REFERENCES `schedule`(`ID`),
	CONSTRAINT `doseTaken_fk1` FOREIGN KEY (`doseID`) REFERENCES `dose`(`doseID`)
) ENGINE=INNODB;

CREATE TABLE IF NOT EXISTS `mood` (
	`ID` int NOT NULL AUTO_INCREMENT,
	`name` varchar(120) NOT NULL,
	`icon` varchar(256),
	PRIMARY KEY (`ID`)
) ENGINE=INNODB;

CREATE TABLE IF NOT EXISTS `moodEntries` (
	`client` int NOT NULL,
	`time` DATETIME NOT NULL,
	`comments` varchar(256),
	`status` int NOT NULL,
	PRIMARY KEY (`client`,`time`),
	CONSTRAINT `moodEntries_fk0` FOREIGN KEY (`client`) REFERENCES `Users`(`ID`),
	CONSTRAINT `moodEntries_fk1` FOREIGN KEY (`status`) REFERENCES `mood`(`ID`)
) ENGINE=INNODB;

CREATE TABLE IF NOT EXISTS `notifications` (
	`clientID` int NOT NULL,
	`doseID` int NOT NULL,
	`scheduleID` int NOT NULL,
	`missed` bool NOT NULL DEFAULT FALSE,
	`taken` bool NOT NULL DEFAULT FALSE,
	`late` bool NOT NULL DEFAULT FALSE,
	`early` bool NOT NULL DEFAULT FALSE,
	PRIMARY KEY (`clientID`,`doseID`,`scheduleID`),
	CONSTRAINT `notifications_fk0` FOREIGN KEY (`clientID`) REFERENCES `Users`(`ID`),
	CONSTRAINT `notifications_fk1` FOREIGN KEY (`doseID`) REFERENCES `dose`(`doseID`),
	CONSTRAINT `notifications_fk2` FOREIGN KEY (`scheduleID`) REFERENCES `schedule`(`ID`)
) ENGINE=INNODB;
