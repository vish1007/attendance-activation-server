const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

/*
Temporary memory database
(For real production use MongoDB)
*/
let users = [];

/*
REGISTER DEVICE
*/
app.post("/register", (req, res) => {
  const { email, deviceId } = req.body;

  const exists = users.find(
    u => u.email === email && u.deviceId === deviceId
  );

  if (exists) {
    return res.json({ status: exists.status });
  }

  users.push({
    id: uuidv4(),
    email,
    deviceId,
    status: "PENDING"
  });

  res.json({ status: "PENDING" });
});

/*
CHECK STATUS
*/
app.post("/check", (req, res) => {
  const { email, deviceId } = req.body;

  const user = users.find(
    u => u.email === email && u.deviceId === deviceId
  );

  if (!user) return res.json({ status: "NOT_FOUND" });

  res.json({ status: user.status });
});

/*
MANUAL APPROVAL ROUTE
(You open in browser to approve)
*/
app.get("/approve/:id", (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.send("User not found");

  user.status = "APPROVED";
  res.send("User Approved");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
app.get("/all", (req, res) => {
  res.json(users);
});
