const api = require("mikronode");

/**
 * IP validation
 * @param {String} ip
 * @returns {Boolean}
 */
const checkIP = function(ip) {
  if (typeof ip !== "string") {
    throw new TypeError("Check your IP address");
  }
  const octets = ip.split(".");
  for (let octet of octets) {
    if (parseInt(octet) < 1 && parseInt(octet) > 254) return false;
  }
  return octets.length === 4;
};

export class Mikrotik {
  /**
   * Router constructor
   * @param {String} ip
   * @param {String} login
   * @param {String} password
   * @param {String} [port="8728"]
   * @param {Number} [timeout=60]
   */
  constructor({ ip, login, password, port = 8728, timeout = 60 }) {
    this.ip = ip;
    this.login = login;
    this.password = password;
    this.port = port;
    this.timeout = timeout;
    this.debug = false;
  }
  /**
   * Connection to router
   * @returns {Object} returns router's object
   */
  async connection() {
    try {
      if (typeof this !== "object") {
        throw new TypeError("Connection must be constructed via new");
      }
      if (!!checkIP(this.ip)) {
        const device = new api(
          /* Host */ this.ip,
          /* Port */ this.port,
          /* Timeout */ this.timeout,
        );
        if (this.debug) device.setDebug(api.DEBUG);
        var connectDevice = await device.connect();
        return await connectDevice[0](this.login, this.password);
      }
      return null;
    } catch (error) {
      throw new Error(`Error due connection to ${this.ip}: ${error}`);
    }
  }
}
