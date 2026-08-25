import handler from "../[...path].js";

export default async function customerByIdHandler(req, res) {
  const id = req.query?.id;
  req.query = { ...(req.query || {}), path: ["customers", String(id)] };
  return handler(req, res);
}
