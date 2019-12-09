import { Mikrotik } from "../../connectors/mikrotik.connect";
import { resultsToObj } from "mikronode";
import decodeAs7bitGSM from "../../utils";
import { Request } from "../../connectors/remote.connect";

const conn = new Mikrotik({
  ip: process.env.MIKROTIK_IP || "192.168.88.1",
  login: process.env.MIKROTIK_LOGIN || "admin",
  password: process.env.MIKROTIK_PASSWORD || "",
});

/**
 * Get information about interfaces (address, mac, name, etc.)
 * @typedef {Object} Interface interface information
 * @property {String} field field name
 * @property {String} value field value
 * @returns {Array<Array<Interface>>} Interface information
 */
export const adresses = async () => {
  const connection = await conn.connection();
  let result = "";
  if (connection.connected) {
    var c2 = connection.openChannel();
    c2.closeOnDone(true);

    console.log("Getting routes");
    c2.write("/ip/address/print");

    result = await new Promise(async resolve => {
      c2.done.subscribe(function(data) {
        resolve(data);
      });
    });
  }

  return result;
};

/**
 * Get imei interface
 * @param {String} modemNumber lte interface (lte1, lte2)
 * @returns {String}  imei
 */
export const imei = async modemNumber => {
  try {
    const connection = await conn.connection();
    if (connection.connected) {
      let c2 = connection.openChannel();
      c2.closeOnDone(true);

      console.log("LTE");
      c2.write("/interface/lte/at-chat", { input: "AT+CGSN", number: modemNumber, wait: "yes" });

      const imeiResult = await new Promise(async function(resolve, reject) {
        c2.done.subscribe(function(data) {
          resolve(data.data[0].value.replace("\\r\\nOK", ""));
        });
      });

      return imeiResult;
    }
  } catch (error) {
    console.error(error);
  }
};

/**
 * Check Tele2 provider
 * @param {String} modemNumber lte interface (lte1, lte2)
 * @returns {String} Balance.
 */
export const balanceTele2 = async modemNumber => {
  const result = await checkBalance("beeline", modemNumber);
  if (!result && !result.length)
    throw new Error(`Can't get Tele2 balance ${JSON.stringify(result)}`);
  const match = result[0][0].value.match(new RegExp('CUSD:.+,"([0-9A-F]+)"'));
  if (!match || !match.length)
    throw new Error(`Can't get Tele2 balance with result: ${JSON.stringify(result)}`);
  const hex = match[1];
  var str = "";
  for (var n = 0; n < hex.length; n += 4) {
    str += String.fromCharCode(parseInt(hex.substr(n, 4), 16));
  }

  return str.match(/OCTATOK (\d+\.\d*)/)[1];
};

/**
 * logs subscriber
 * Send balanse to remote server
 * @returns {void}
 */
export const logs = async () => {
  try {
    const connection = await conn.connection();
    const c3 = connection.openChannel();
    c3.closeOnDone(true);
    c3.write("/log/listen");
    c3.data
      .filter(d => d.data[d.data.length - 1].field !== ".dead" && d.data[2].value === "gsm,info")
      .subscribe(async d => {
        const data = resultsToObj(
          d.data.filter(col => ["time", "topics", "message"].includes(col.field)),
        );
        const balance = checkTmpl(data.message);
        if (!!balance) {
          balance.id = await getIdentity();
          Request(balance, { path: "balance" }).catch(e => {
            console.log(`Ошибка при посыле баланса: ${e}`);
          });
        }
      });
  } catch (e) {
    console.log(`Error in connection to mikrotik! Trying again! ${new Date()}`);
    setTimeout(function() {
      logs();
    }, 30000);
  }
};

/**
 * Get router ID
 * @returns {String}.
 */
const getIdentity = async () => {
  const connection = await conn.connection();
  const ch = connection.openChannel();
  ch.closeOnDone(true);
  ch.write("/system/identity/print");
  const id = await new Promise(async resolve => {
    ch.data.subscribe(function(data) {
      console.log(data);
      resolve(data.data[0].value);
    });
  });
  return id;
};

/**
 * Check log for template
 * @param {String} msg Checking message.
 * @typedef {Object} Balance
 * @property {String} operator Cellular provider
 * @property {String} balance Current balance
 * @returns {Balance} Returns operator and balance
 */
const checkTmpl = msg => {
  const tmpl = {
    beeline: new RegExp("Vash balans (.*) r"),
    MTS: new RegExp("Balance:(.*)r"),
    TELE2: /OCTATOK (\d+\.\d*)/,
  };
  for (let operator in tmpl) {
    const match = msg.match(tmpl[operator]);
    if (match && match.length && match.length > 1) {
      return { operator, balance: match[1] };
    }
  }
  return;
};

/**
 * Check MST provider
 * @param {String} modemNumber lte interface (lte1, lte2)
 * @returns {String} Returns balance or waiting message.
 */
export const balanceMTS = async modemNumber => {
  const result = await checkBalance("mts", modemNumber);
  if (!result && !result.length) throw new Error(`Can't get MTS balance ${JSON.stringify(result)}`);
  const match = result[0][0].value.match(new RegExp('CUSD:.+,"([0-9A-F]+)"'));
  if (!match || !match.length) {
    const ok = result[0][0].value.match(new RegExp("OK"));
    if (!ok || !ok.length) throw new Error(`Can't get MTS balance ${JSON.stringify(result)}`);
    return "waiting result";
  }
  const hex = match[1];
  const str = decodeAs7bitGSM(hex)
    .replace("Balance:", "")
    .replace("r", "");

  return str;
};

/**
 * Check Beeline provider
 * @param {String} modemNumber lte interface (lte1, lte2)
 * @returns {String} Returns balance or waiting message.
 */
export const balanceBeeline = async modemNumber => {
  const result = await checkBalance("beeline", modemNumber);
  if (!result && !result.length)
    throw new Error(`Error check Beeline balance: ${JSON.stringify(result)}`);
  const match = result[0][0].value.match(new RegExp('CUSD:.+,"([0-9A-F]+)"'));
  if (!match || !match.length) return "waiting result";
  const hex = match[1];
  const str = decodeAs7bitGSM(hex)
    .replace("Balance:", "")
    .replace("r", "");

  return str;
};

/**
 * Get lte interface info
 * @param {String} modemNumber lte interface (lte1, lte2)
 * @type {Object} info interface information
 * @property {String} field field name
 * @property {String} value field value
 * @returns {Array<info>} info array.
 */
export const lteInfo = async modemNumber => {
  const connection = await conn.connection();
  if (connection.connected) {
    var c2 = connection.openChannel();
    c2.closeOnDone(true);

    c2.write("/interface/lte/info", { number: modemNumber, once: true });

    const infoResult = await new Promise(async resolve => {
      c2.data.subscribe(function(data) {
        resolve(data);
      });
    });

    return infoResult;
  }
};

/**
 * Check balance function
 * @param {String} operator Cellular provider
 * @param {String} modemNumber lte interface (lte1, lte2)
 * @returns {Promise<String>} USSD response
 */
function checkBalance(operator, modemNumber) {
  let ussdRequest = "";
  switch (operator) {
    case "mts":
      ussdRequest = "A3180C3602";
      break;
    case "tele2":
      ussdRequest = "AA18AC3602";
      break;
    case "beeline":
      ussdRequest = "A3184C3602";
      break;
    case "yota":
      ussdRequest = "AA180C3602";
      break;
    default:
      throw new Error("unssuported operator");
  }
  return new Promise(async (resolve, reject) => {
    try {
      const connection = await conn.connection();
      if (connection.connected) {
        var c = connection.openChannel();
        c.closeOnDone(true);
        c.write("/interface/lte/at-chat", {
          input: `AT+CUSD=1,\"${ussdRequest}\",15`,
          number: modemNumber,
          wait: "yes",
        });
        c.done.subscribe(function(result) {
          resolve(result.data);
        });
      }
    } catch (error) {
      reject(error);
    }
  });
}
