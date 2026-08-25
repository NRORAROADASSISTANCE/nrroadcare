import handler from "./[...path].js";

export default async function employeesHandler(req, res) {
  const pathname = String(req.url || "").split("?")[0];
  const path = pathname.replace(/^\/api\//, "").replace(/^\/+|\/+$/g, "");
  req.query = { ...(req.query || {}), path };
  return handler(req, res);
}
