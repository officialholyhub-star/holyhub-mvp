import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const { isPermittedPrivateCrmPath: permits } = loadTypescript("lib/crm/private-site/routes.ts");

// Synthetic specification only. Not imported by the application.
// Fixed destinations deliberately ignore arbitrary caller-provided return URLs.
const loginDestination = () => "/admin/crm";
const logoutDestination = () => "/auth/login";
function staffDecision({ signedIn, error, currentLevel, nextLevel, active, role, allowedRoles }) {
  if (!signedIn) return "login";
  if (error || !currentLevel || !nextLevel) return "deny";
  if (currentLevel === "aal1" && nextLevel === "aal1") return "enrolment-required";
  if (currentLevel === "aal1" && nextLevel === "aal2") return "challenge-required";
  if (currentLevel !== "aal2" || nextLevel !== "aal2") return "deny";
  return active && allowedRoles.includes(role) ? "allow" : "deny";
}

test("fixed CRM login/logout destinations are allowlisted, unlike public defaults", () => {
  for (const input of ["/account", "/", "https://example.invalid", "//example.invalid", "/checkout", "/admin/crm?next=bad"]) {
    assert.equal(loginDestination(input), "/admin/crm");
    assert.equal(logoutDestination(input), "/auth/login");
  }
  assert.equal(permits(loginDestination()), true);
  assert.equal(permits(logoutDestination()), true);
  assert.equal(permits("/account"), false);
  assert.equal(permits("/"), false);
});

const fixture = { signedIn: true, error: false, currentLevel: "aal2", nextLevel: "aal2", active: true, role: "crm_operator", allowedRoles: ["crm_operator"] };
test("synthetic MFA state matrix fails closed", () => {
  for (const [change, expected] of [
    [{}, "allow"],
    [{signedIn:false}, "login"],
    [{currentLevel:"aal1",nextLevel:"aal1"}, "enrolment-required"],
    [{currentLevel:"aal1"}, "challenge-required"],
    [{nextLevel:"aal1"}, "deny"],
    [{error:true}, "deny"],
    [{currentLevel:null}, "deny"],
    [{nextLevel:undefined}, "deny"],
    [{active:false}, "deny"],
    [{role:"crm_viewer"}, "deny"],
    [{role:null}, "deny"],
  ]) assert.equal(staffDecision({...fixture,...change}),expected);
});

test("viewers also require MFA; a role cannot bypass assurance", () => {
  const viewer = {...fixture,role:"crm_viewer",allowedRoles:["crm_viewer"]};
  assert.equal(staffDecision(viewer),"allow");
  assert.equal(staffDecision({...viewer,currentLevel:"aal1"}),"challenge-required");
});
