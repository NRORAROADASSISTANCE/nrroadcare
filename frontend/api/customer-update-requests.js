import handler from "./[...path].js";
export default async function(req,res){
  req.query={...(req.query||{}),path:"customer-update-requests"};
  return handler(req,res);
}
