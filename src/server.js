require("dotenv").config();
const express = require("express");
const webhookWhatsapp = require("./whatsapp/webhookController");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send("EmbarqueRH no ar");
});

app.use("/webhook/whatsapp", webhookWhatsapp);

app.listen(PORT, () => {
  console.log(`EmbarqueRH rodando em http://localhost:${PORT}`);
});
