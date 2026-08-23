import { firestore } from "../lib/firestore";
import { ROLES } from "@/lib/auth/role-labels";

/**
 * One-time script to set up CSM Dashboard test data.
 * Run: npx ts-node scripts/setup-csm-test-data.ts
 */

/*
 * Environment guard, required by CLAUDE.md for every scripts/setup-* script
 * and absent from this one until story 14.B touched the file.
 *
 * It matters more here than the rule suggests. TEST_CLIENT_ID below is a real
 * Firestore document id, and this script writes to `clients/{id}` with .set().
 * Run against production with an unset project, it overwrites whatever live
 * client happens to hold that id with fabricated test data. The sibling
 * scripts/setup-test-data.mjs has carried this guard all along; this one did
 * not, and nothing noticed because the check that enforces it only reads files
 * in the commit.
 */
if (process.env.NODE_ENV === "production") {
  console.error("NODE_ENV is production. Refusing to seed fabricated test data.");
  process.exit(1);
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) {
  console.error(
    "GOOGLE_CLOUD_PROJECT is not set. Refusing to run against an unknown/default project.",
  );
  process.exit(1);
}

console.log(`Seeding CSM test data into Firestore project: ${projectId}`);

const TEST_CLIENT_ID = "cMIc51hn6ziLwWtC8t0n";
const TEST_CSM_EMAIL = "test@taxadvisorygrowth.net";

async function setupTestData() {
  console.log("🚀 Setting up CSM Dashboard test data...\n");

  try {
    // 1. Create test client
    console.log(`📝 Creating test client: Casey Williams Co (${TEST_CLIENT_ID})`);
    await firestore().collection("clients").doc(TEST_CLIENT_ID).set({
      name: "Casey Williams Co",
      ghl_location_id: TEST_CLIENT_ID,
      drive_folder_id: "1xtentcq18ioOH9m0dIqQV9vxX6aqLM51",
      csm_assigned: TEST_CSM_EMAIL,
      active: true,
      health_targets: {
        roas_target: 3.5,
        monthly_spend_target: 25000,
        monthly_leads_target: 150,
        response_sla_hours: 24,
      },
      last_health_score: 91,
      last_health_update: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    console.log("✅ Client created\n");

    // 2. Create sample alerts
    console.log(`📢 Creating sample alerts...`);
    const alertsCollection = firestore().collection("clients").doc(TEST_CLIENT_ID).collection("alerts");

    await alertsCollection.add({
      type: "info",
      title: "Weekly Review",
      message: "Casey Williams Co has completed their weekly performance review. All metrics on track.",
      created_at: new Date().toISOString(),
    });

    await alertsCollection.add({
      type: "warning",
      title: "Spend Approaching Budget",
      message: "Monthly spend is at 98% of target budget ($24,500 of $25,000). Monitor closely.",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    });

    await alertsCollection.add({
      type: "critical",
      title: "ROAS Below Target",
      message: "ROAS dropped to 3.2x (below 3.5x target). Review ad creative and targeting.",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      resolved_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // resolved 1 day ago
    });

    console.log("✅ Alerts created\n");

    // 3. Create sample creatives
    console.log(`🎨 Creating sample creatives...`);
    const creativesCollection = firestore().collection("clients").doc(TEST_CLIENT_ID).collection("creatives");

    await creativesCollection.add({
      filename: "facebook_carousel_approved.mp4",
      status: "approved",
      format: "video",
      platforms: ["facebook", "instagram"],
      drive_file_id: "sample-1",
      uploaded_by: TEST_CSM_EMAIL,
      uploaded_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await creativesCollection.add({
      filename: "instagram_image_pending.jpg",
      status: "pending-approval",
      format: "image",
      platforms: ["instagram"],
      drive_file_id: "sample-2",
      uploaded_by: TEST_CSM_EMAIL,
      uploaded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await creativesCollection.add({
      filename: "meta_carousel_draft.mp4",
      status: "draft",
      format: "video",
      platforms: ["meta"],
      drive_file_id: "sample-3",
      uploaded_by: TEST_CSM_EMAIL,
      uploaded_at: new Date().toISOString(),
    });

    console.log("✅ Creatives created\n");

    // 4. Create CSM settings
    console.log(`⚙️  Creating CSM settings...`);
    await firestore().collection("csm_settings").doc(TEST_CSM_EMAIL).set({
      name: "Test CSM",
      assigned_clients: [TEST_CLIENT_ID],
      health_weights: {
        roas: 35,
        spend: 25,
        leads: 25,
        sla: 15,
      },
      role: ROLES.TAG_CSM,
    });
    console.log("✅ CSM settings created\n");

    console.log("✅ All test data created successfully!");
    console.log("\nYou can now:");
    console.log(`1. Sign in as ${TEST_CSM_EMAIL} with role "${ROLES.TAG_CSM}"`);
    console.log("2. Navigate to /csm-dashboard");
    console.log("3. See Casey Williams Co in your portfolio\n");
  } catch (error) {
    console.error("❌ Error setting up test data:", error);
    process.exit(1);
  }
}

setupTestData();
