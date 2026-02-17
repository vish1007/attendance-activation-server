const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const session = require("express-session");

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(session({
  secret: "attendance-secret",
  resave: false,
  saveUninitialized: false
}));

/* ================= MONGODB CONNECT ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("Mongo Error:", err));

/* ================= USER MODEL ================= */

const userSchema = new mongoose.Schema({
  email: String,
  deviceId: String,
  status: { type: String, default: "PENDING" },
  lastActive: Date
});

const User = mongoose.model("User", userSchema);

/* ================= REGISTER ================= */

app.post("/register", async (req, res) => {
  try {
    const { email, deviceId } = req.body;

    let user = await User.findOne({ deviceId });

    if (!user) {
      user = await User.create({ email, deviceId });

      // Send Email Notification
      try {
        const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: "New Activation Request",
          html: `
            <h3>New Activation Request</h3>
            <p><b>Email:</b> ${email}</p>
            <p><b>Device:</b> ${deviceId}</p>
            <a href="https://attendance-activation-server.onrender.com/approve/${deviceId}">
              Approve This Device
            </a>
          `
        });

        console.log("Activation email sent");
      } catch (mailError) {
        console.error("Email error:", mailError);
      }
    }

    res.json({ status: user.status });

  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= CHECK ================= */

app.post("/check", async (req, res) => {
  try {
    const { deviceId } = req.body;

    const user = await User.findOne({ deviceId });

    if (!user) return res.json({ status: "NOT_FOUND" });

    res.json({ status: user.status });

  } catch (err) {
    console.error("Check error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= ADMIN LOGIN ================= */

app.get("/admin-login", (req, res) => {
  res.send(`
    <h2>Admin Login</h2>
    <form method="POST" action="/admin-login">
      <input name="username" placeholder="Username" required/><br/><br/>
      <input name="password" type="password" placeholder="Password" required/><br/><br/>
      <button>Login</button>
    </form>
  `);
});

app.post("/admin-login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session.admin = true;
    return res.redirect("/admin");
  }

  res.send("Invalid credentials");
});

/* ================= ADMIN DASHBOARD ================= */

app.get("/admin", async (req, res) => {

  if (!req.session.admin)
    return res.redirect("/admin-login");

  const users = await User.find();

  let html = `
    <h2>Activation Dashboard</h2>
    <a href="/logout">Logout</a>
    <hr/>
  `;

  users.forEach(u => {
    html += `
      <div style="margin-bottom:20px;">
        <b>Email:</b> ${u.email}<br/>
        <b>Device:</b> ${u.deviceId}<br/>
        <b>Status:</b> ${u.status}<br/>
        <b>Last Active:</b> ${u.lastActive || "Never"}<br/>
        <a href="/approve/${u.deviceId}">Approve</a> |
        <a href="/block/${u.deviceId}">Block</a>
        <hr/>
      </div>
    `;
  });

  res.send(html);
});

/* ================= LOGOUT ================= */

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin-login");
  });
});

/* ================= APPROVE ================= */

app.get("/approve/:deviceId", async (req, res) => {

  if (!req.session.admin)
    return res.redirect("/admin-login");

  const user = await User.findOne({ deviceId: req.params.deviceId });

  if (!user) return res.send("User not found");

  user.status = "APPROVED";
  await user.save();

  // Send approval email
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Your Activation is Approved",
      html: `
        <h3>Activation Approved</h3>
        <p>Hello,</p>
        <p>Your device has been successfully approved.</p>
        <p>You can now use the Attendance Application.</p>
      `
    });

  } catch (err) {
    console.error("Approval email failed:", err);
  }

  res.redirect("/admin");
});


/* ================= BLOCK ================= */

app.get("/block/:deviceId", async (req, res) => {

  if (!req.session.admin)
    return res.redirect("/admin-login");

  const user = await User.findOne({ deviceId: req.params.deviceId });

  if (!user) return res.send("User not found");

  user.status = "BLOCKED";
  await user.save();

  // Send block email
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Your Access Has Been Blocked",
      html: `
        <h3>Access Blocked</h3>
        <p>Hello,</p>
        <p>Your access to the Attendance Application has been blocked.</p>
        <p>Please contact the administrator for support.</p>
      `
    });

  } catch (err) {
    console.error("Block email failed:", err);
  }

  res.redirect("/admin");
});


/* ================= HEARTBEAT ================= */

app.post("/heartbeat", async (req, res) => {
  try {
    const { deviceId } = req.body;

    await User.updateOne(
      { deviceId },
      { lastActive: new Date() }
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Heartbeat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= START SERVER ================= */

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
