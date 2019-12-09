require("dotenv").config();
import express from "express";
import { mikrotik } from "./logic/mikrotik";

const app = express();

require("./errorLogs")(app);

//Run logs subscriber
mikrotik.logs();

app.get("/api/balance/:lteInterface/:operator", async (req, res) => {
  const { lteInterface, operator } = req.params;
  let success = true,
    msg;
  try {
    switch (operator) {
      case "mts":
        msg = await mikrotik.balanceMTS(lteInterface);
        break;
      case "tele2":
      case "yota":
        msg = await mikrotik.balanceTele2(lteInterface);
        break;
      case "beeline":
        msg = await mikrotik.balanceBeeline(lteInterface);
        break;
      default:
        msg = "unsupported operator";
        break;
    }
  } catch (error) {
    success = !success;
    msg = error;
  }

  res.json({ success, msg });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("MikroNode - started on 3000 port");
});
