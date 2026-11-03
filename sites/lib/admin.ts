import { notFound } from "next/navigation";
import { member, isAdmin } from "./data";
export async function admin(path="/admin"){const user=await member(path);if(!isAdmin(user.email))notFound();return user;}
