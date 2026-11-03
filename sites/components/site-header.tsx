import Image from "next/image";
import Link from "@/components/site-link";
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { HeaderNavigation } from "./header-navigation";
export async function SiteHeader() {
 const user=await getChatGPTUser();
 return <header className="site-header"><Link className="logo-wrap" href="/" aria-label="HolyHub home"><Image className="logo-image" src="/holyhub-logo.png" width={168} height={85} alt="HolyHub" priority/></Link><nav className="header-actions" aria-label="Main navigation"><HeaderNavigation/><div className="header-account">{user?<><Link className="button button-primary" href="/account">My account</Link><a className="nav-link" href={chatGPTSignOutPath()} target="_top">Log out</a></>:<><a className="nav-link" href={chatGPTSignInPath("/account")} target="_top">Log in</a><a className="button button-primary" href={chatGPTSignInPath("/account")} target="_top">Join HolyHub</a></>}</div></nav></header>;
}
