CREATE TABLE `sync_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`wrappedKeyCiphertext` text NOT NULL,
	`wrappedKeyInitializationVector` text NOT NULL,
	`wrappedKeyAuthenticationTag` text NOT NULL,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sync_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `sync_devices_token_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `backup_versions` MODIFY COLUMN `sourceOperation` enum('backup','restore','scheduled','device') NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_versions` ADD `syncDeviceId` int;--> statement-breakpoint
ALTER TABLE `sync_devices` ADD CONSTRAINT `sync_devices_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sync_devices_user_idx` ON `sync_devices` (`userId`);--> statement-breakpoint
ALTER TABLE `backup_versions` ADD CONSTRAINT `backup_versions_syncDeviceId_sync_devices_id_fk` FOREIGN KEY (`syncDeviceId`) REFERENCES `sync_devices`(`id`) ON DELETE set null ON UPDATE no action;