const session = require("express-session");
const nodemailer = require("nodemailer");

app.use(session({
  secret: "attendance-secret",
  resave: false,
  saveUninitialized: false
}));

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

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
  const { email, deviceId } = req.body;

  let user = await User.findOne({ deviceId });

  // If user does NOT exist → new activation request
  if (!user) {

    user = await User.create({ email, deviceId });

    // 🔔 SEND EMAIL ONLY FOR NEW REQUEST
    const transporter = nodemailer.createTransport({
      service: "gmail",
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
        <p>Email: ${email}</p>
        <p>Device: ${deviceId}</p>
        <a href="https://attendance-activation-server.onrender.com/approve/${deviceId}">
          Approve This Device
        </a>
      `
    });
  }

  res.json({ status: user.status });
});


/* ================= CHECK ================= */

app.post("/check", async (req, res) => {
  const { deviceId } = req.body;

  const user = await User.findOne({ deviceId });

  if (!user) return res.json({ status: "NOT_FOUND" });

  res.json({ status: user.status });
});

/* ================= ADMIN DASHBOARD ================= */
app.get("/admin-login", (req, res) => {
  res.send(`
    <h2>Admin Login</h2>
    <form method="POST" action="/admin-login">
      <input name="username" placeholder="Username"/><br/>
      <input name="password" type="password" placeholder="Password"/><br/>
      <button>Login</button>
    </form>
  `);
});

app.post("/admin-login", express.urlencoded({ extended: true }), (req, res) => {
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

app.get("/admin", async (req, res) => {

  if (!req.session.admin)
    return res.redirect("/admin-login");

  const users = await User.find();

  let html = "<h2>Activation Admin</h2>";

  users.forEach(u => {
    html += `
      <div style="margin-bottom:15px;">
        <b>${u.email}</b><br/>
        ${u.deviceId}<br/>
        Status: ${u.status}<br/>
        <a href="/approve/${u.deviceId}">Approve</a> |
        <a href="/block/${u.deviceId}">Block</a>
        <hr/>
      </div>
    `;
  });

  res.send(html);
});

/* ================= APPROVE ================= */

app.get("/approve/:deviceId", async (req, res) => {
  await User.updateOne(
    { deviceId: req.params.deviceId },
    { status: "APPROVED" }
  );
  res.redirect("/admin");
});

/* ================= BLOCK ================= */

app.get("/block/:deviceId", async (req, res) => {
  await User.updateOne(
    { deviceId: req.params.deviceId },
    { status: "BLOCKED" }
  );
  res.redirect("/admin");
});

/* ================= HEARTBEAT ================= */

app.post("/heartbeat", async (req, res) => {
  const { deviceId } = req.body;

  await User.updateOne(
    { deviceId },
    { lastActive: new Date() }
  );

  res.json({ success: true });
});

/* ================= START SERVER ================= */

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
