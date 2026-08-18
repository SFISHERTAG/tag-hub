import { firestore } from "../lib/firestore";
import { assertSafeToSeed } from "./lib/seed-guard.mjs";

/**
 * Script to set up Phase 3 test data (creative-campaign mappings).
 * Run: npx ts-node scripts/setup-phase3-test-data.ts
 *
 * This script adds Meta creative-to-campaign mappings for the test client.
 */

const TEST_CLIENT_ID = "cMIc51hn6ziLwWtC8t0n";

async function setupPhase3TestData() {
  console.log("🚀 Setting up Phase 3 test data (creative-campaign mappings)...\n");

  try {
    // Refuses to run unless NODE_ENV is "development" and GOOGLE_CLOUD_PROJECT
    // is set to something other than production. See scripts/lib/seed-guard.mjs.
    assertSafeToSeed();

    // Sample Meta campaign and creative IDs (these would be real IDs from Meta Ads Manager)
    const testCampaigns = [
      {
        id: "campaign_001",
        name: "Spring 2026 Campaign",
        status: "ACTIVE",
      },
      {
        id: "campaign_002",
        name: "Summer Promo",
        status: "ACTIVE",
      },
      {
        id: "campaign_003",
        name: "Fall Retargeting",
        status: "PAUSED",
      },
    ];

    const testCreatives = [
      {
        id: "ad_001",
        name: "Spring Product Video",
        campaigns: [testCampaigns[0]], // campaign_001
      },
      {
        id: "ad_002",
        name: "Hero Image Carousel",
        campaigns: [testCampaigns[0], testCampaigns[1]], // campaign_001, campaign_002
      },
      {
        id: "ad_003",
        name: "Testimonial Video",
        campaigns: [testCampaigns[1], testCampaigns[2]], // campaign_002, campaign_003
      },
      {
        id: "ad_004",
        name: "Limited Time Offer Banner",
        campaigns: [testCampaigns[2]], // campaign_003
      },
    ];

    // Create meta_creatives collection with campaign mappings
    console.log(`📝 Creating ${testCreatives.length} Meta creatives with campaign links...`);
    const metaCreativesCollection = firestore()
      .collection("clients")
      .doc(TEST_CLIENT_ID)
      .collection("meta_creatives");

    for (const creative of testCreatives) {
      await metaCreativesCollection.doc(creative.id).set({
        id: creative.id,
        name: creative.name,
        status: "ACTIVE",
        effective_status: "ACTIVE",
        created_time: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        campaigns_using: creative.campaigns.map((campaign) => ({
          campaignId: campaign.id,
          campaignName: campaign.name,
          status: campaign.status,
        })),
        last_synced: new Date().toISOString(),
      });

      console.log(
        `  ✅ Created ${creative.name} (linked to ${creative.campaigns.length} campaign${creative.campaigns.length !== 1 ? "s" : ""})`,
      );
    }

    console.log("\n✅ Phase 3 test data created successfully!");
    console.log("\nYou can now test:");
    console.log("1. CampaignsTab shows creative counts for each campaign");
    console.log("2. CreativesTab shows which campaigns each creative is used in");
    console.log("3. Cross-navigation between tabs works with campaign references\n");
  } catch (error) {
    console.error("❌ Error setting up test data:", error);
    process.exit(1);
  }
}

setupPhase3TestData();
