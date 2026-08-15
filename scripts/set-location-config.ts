#!/usr/bin/env npx ts-node

/**
 * Admin script to set location configuration in Firestore.
 * Usage: npx ts-node scripts/set-location-config.ts <locationId> <driveFolderId> [slackChannelId]
 */

import { firestore } from "@/lib/firestore";

const [, , locationId, driveFolderId, slackChannelId] = process.argv;

if (!locationId || !driveFolderId) {
  console.error(
    "Usage: npx ts-node scripts/set-location-config.ts <locationId> <driveFolderId> [slackChannelId]"
  );
  console.error(
    "Example: npx ts-node scripts/set-location-config.ts cMIc51hn6ziLwWtC8t0n 1xtentcq18ioOH9m0dIqQV9vxX6aqLM51"
  );
  process.exit(1);
}

async function setConfig() {
  try {
    const db = firestore();
    const configRef = db.doc(`locations/${locationId}`);

    const data: Record<string, string> = {
      driveFolderId,
    };

    if (slackChannelId) {
      data.slackChannelId = slackChannelId;
    }

    await configRef.set(data, { merge: true });

    console.log(`✅ Set config for location ${locationId}`);
    console.log(`   driveFolderId: ${driveFolderId}`);
    if (slackChannelId) {
      console.log(`   slackChannelId: ${slackChannelId}`);
    }
  } catch (error) {
    console.error("❌ Error setting config:", error);
    process.exit(1);
  }
}

setConfig();
