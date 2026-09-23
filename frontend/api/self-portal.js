import handler from "./[...path].js";
export default async function(req,res){
  req.query={...(req.query||{}),path:"self-portal"};
  return handler(req,res);
}
