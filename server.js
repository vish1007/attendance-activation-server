const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

let users = [];

/* ================= REGISTER ================= */
app.post("/register", (req, res) => {
  const { email, deviceId } = req.body;

  let user = users.find(
    u => u.email === email && u.deviceId === deviceId
  );

  if (user) {
    return res.json({ status: user.status });
  }

  const newUser = {
    id: uuidv4(),
    email,
    deviceId,
    status: "PENDING",
    createdAt: new Date()
  };

  users.push(newUser);

  res.json({ status: "PENDING" });
});

/* ================= CHECK ================= */
app.post("/check", (req, res) => {
  const { email, deviceId } = req.body;

  const user = users.find(
    u => u.email === email && u.deviceId === deviceId
  );

  if (!user) return res.json({ status: "NOT_FOUND" });

  res.json({ status: user.status });
});

/* ================= ADMIN PAGE ================= */
app.get("/admin", (req, res) => {
  let html = `
    <h2>Activation Requests</h2>
    <style>
      body { font-family: Arial; padding: 20px; }
      .card { border:1px solid #ccc; padding:15px; margin-bottom:15px; border-radius:8px; }
      .approved { color:green; font-weight:bold; }
      .pending { color:orange; font-weight:bold; }
      button { padding:6px 12px; cursor:pointer; }
    </style>
  `;

  users.forEach(user => {
    html += `
      <div class="card">
        <p><b>Email:</b> ${user.email}</p>
        <p><b>Device ID:</b> ${user.deviceId}</p>
        <p>Status: 
          <span class="${user.status === "APPROVED" ? "approved" : "pending"}">
            ${user.status}
          </span>
        </p>
        ${
          user.status === "PENDING"
            ? `<form method="POST" action="/approve/${user.id}">
                 <button type="submit">Approve</button>
               </form>`
            : ""
        }
      </div>
    `;
  });

  res.send(html);
});

/* ================= APPROVE ================= */
app.post("/approve/:id", (req, res) => {
  const user = users.find(u => u.id === req.params.id);

  if (!user) return res.send("User not found");

  user.status = "APPROVED";

  res.redirect("/admin");
});

/* ================= DEBUG (optional) ================= */
app.get("/all", (req, res) => {
  res.json(users);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
app.get("/all", (req, res) => {
  res.json(users);
});
