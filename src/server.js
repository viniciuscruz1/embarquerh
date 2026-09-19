require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const webhookWhatsapp = require("./whatsapp/webhookController");
const adminRoutes = require("./admin/routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "admin/views"));

app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

app.get("/", (req, res) => {
  res.send("EmbarqueRH no ar");
});

app.use("/webhook/whatsapp", webhookWhatsapp);
app.use("/admin", adminRoutes);

app.listen(PORT, () => {
  console.log(`EmbarqueRH rodando em http://localhost:${PORT}`);
});
