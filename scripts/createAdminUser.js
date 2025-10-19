const mongoose = require("mongoose");
const { User } = require("../models/userModel");
require("dotenv").config();

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: "admin@hayotush.com" });
    if (existingAdmin) {
      console.log("👤 Admin user already exists:");
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.name}`);
      console.log(`   isAdmin: ${existingAdmin.isAdmin}`);

      // Update to admin if not already
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log("✅ Updated user to admin");
      }
    } else {
      // Create new admin user
      const adminUser = new User({
        name: "מנהל המערכת",
        email: "admin@hayotush.com",
        password: "admin123456", // This will be hashed automatically
        isAdmin: true,
        subscriptionPlan: "gold",
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        points: 1000,
        coins: 500,
        termsAccepted: true,
        privacyAccepted: true,
        consentTimestamp: new Date(),
        consentVersion: "1.0",
      });

      await adminUser.save();
      console.log("✅ Admin user created successfully:");
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Password: admin123456`);
      console.log(`   Name: ${adminUser.name}`);
    }

    // Show all admin users
    const adminUsers = await User.find({ isAdmin: true });
    console.log("\n📋 All admin users:");
    adminUsers.forEach((user, index) => {
      console.log(
        `   ${index + 1}. ${user.name} (${user.email}) - Admin: ${user.isAdmin}`
      );
    });
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
createAdminUser();
