// Signing in: a wrong password gets a clear message, and stray spaces from copy/paste don't block a right one.
import request from "supertest";
import { setup, PW } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});

describe("sign in", () => {
  it("says plainly when the email or password is wrong", async () => {
    const r = await request(ctx.app).post("/api/auth/login").send({ email: "owner@caliber.test", password: "not-the-password" }).expect(401);
    expect(r.body.message).toBe("Wrong email or password");
  });

  it("ignores spaces before or after the email and password", async () => {
    await request(ctx.app).post("/api/auth/login").send({ email: "  OWNER@caliber.test ", password: ` ${PW}  ` }).expect(200);
  });
});
