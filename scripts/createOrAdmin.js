const mongoose = require("mongoose");
const { User } = require("../models/userModel");
const bcrypt = require("bcrypt");
require("dotenv").config();

async function createOrAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if user already exists
    const existingUser = await User.findOne({ email: "or1@gmail.com" });
    if (existingUser) {
      console.log("👤 User already exists, updating to admin:");
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Name: ${existingUser.name}`);

      // Update to admin
      existingUser.isAdmin = true;
      existingUser.subscriptionPlan = "gold";
      existingUser.name = "Or Admin";
      await existingUser.save();
      console.log("✅ Updated user to admin");
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash("Password123", 10);
      const adminUser = new User({
        name: "Or Admin",
        email: "or1@gmail.com",
        password: hashedPassword,
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
      console.log(`   Password: Password123`);
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
createOrAdmin();

