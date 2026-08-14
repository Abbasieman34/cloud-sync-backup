CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileId` int,
	`action` enum('backup','sync','restore','schedule') NOT NULL,
	`status` enum('success','failed') NOT NULL,
	`detail` varchar(1000) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backup_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`cronExpression` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`lastRunStatus` enum('success','failed'),
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backup_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `backup_schedules_task_uid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `backup_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`backupsEnabled` boolean NOT NULL DEFAULT true,
	`maxUploadMegabytes` int NOT NULL DEFAULT 50,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backup_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backup_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileId` int NOT NULL,
	`userId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`byteSize` bigint NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`encryptionAlgorithm` varchar(64) NOT NULL,
	`initializationVector` text NOT NULL,
	`authenticationTag` text NOT NULL,
	`sourceOperation` enum('backup','restore','scheduled') NOT NULL,
	`restoredFromVersionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backup_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `backup_versions_file_version_unique` UNIQUE(`fileId`,`versionNumber`)
);
--> statement-breakpoint
CREATE TABLE `managed_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`logicalPath` varchar(512) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`mimeType` varchar(255) NOT NULL,
	`byteSize` bigint NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`syncStatus` enum('synced','pending','error') NOT NULL DEFAULT 'pending',
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managed_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `managed_files_user_path_unique` UNIQUE(`userId`,`logicalPath`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_fileId_managed_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `managed_files`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_schedules` ADD CONSTRAINT `backup_schedules_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_schedules` ADD CONSTRAINT `backup_schedules_fileId_managed_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `managed_files`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_settings` ADD CONSTRAINT `backup_settings_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_versions` ADD CONSTRAINT `backup_versions_fileId_managed_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `managed_files`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_versions` ADD CONSTRAINT `backup_versions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `managed_files` ADD CONSTRAINT `managed_files_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_logs_user_created_idx` ON `activity_logs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `backup_schedules_user_enabled_idx` ON `backup_schedules` (`userId`,`enabled`);--> statement-breakpoint
CREATE INDEX `backup_versions_user_created_idx` ON `backup_versions` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `managed_files_user_sync_idx` ON `managed_files` (`userId`,`syncStatus`);