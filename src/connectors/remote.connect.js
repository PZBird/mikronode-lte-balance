import request from "async-request";

/**
 * Request wrapper
 * @param {Object} data POST data
 * @param {Object} params Request params (host, scheme, path, port, method)
 * @returns {Promise} Returns request promise
 */
export const Request = async (data, params = {}) => {
  const scheme = params.scheme || process.env.REMOTE_SCHEME || "http";
  const host = params.host || process.env.REMOTE_HOST;
  if (!host) return;
  const path = params.path || `${process.env.REMOTE_ROOT_PATH}` || "";
  const port = `:${params.port || process.env.REMOTE_DEFAULT_PORT || ""}`;
  const options = {
    method: params.method || "POST",
    data,
    headers: {
      "content-type": "application/json",
    },
  };
  const uri = `${scheme}://${host}${port}${path}`;
  return request(uri, options);
};
