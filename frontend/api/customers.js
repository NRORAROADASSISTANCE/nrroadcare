import handler from "./[...path].js";

export default async function customersHandler(req, res) {
  req.query = { ...(req.query || {}), path: ["customers"] };
  return handler(req, res);
}
