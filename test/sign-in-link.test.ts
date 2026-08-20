import { afterEach, describe, expect, it } from "vitest";

/**
 * The security properties of the sign-in link are the reason it is built the
 * way it is, so they are asserted rather than left to the comments: the code
 * rides in the fragment so it never reaches a server log, the origin comes from
 * configuration so a Host header cannot redirect the link, and plaintext http
 * is refused outside local development.
 */

const original = process.env.PUBLIC_BASE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.PUBLIC_BASE_URL;
  else process.env.PUBLIC_BASE_URL = original;
});

async function load() {
  return await import("@/lib/auth/base-url");
}

describe("signInLink", () => {
  it("puts the credentials in the fragment, never the query string", async () => {
    process.env.PUBLIC_BASE_URL = "https://hub.example.com";
    const { signInLink } = await load();

    const link = signInLink("someone@example.com", "123456");
    const url = new URL(link);

    expect(url.search).toBe("");
    expect(url.hash).toContain("c=123456");
    // The part a server, a proxy, or a Referer header would ever see.
    expect(`${url.origin}${url.pathname}`).toBe("https://hub.example.com/signin");
  });

  it("escapes the address rather than splicing it in raw", async () => {
    process.env.PUBLIC_BASE_URL = "https://hub.example.com";
    const { signInLink } = await load();

    expect(signInLink("a+b@example.com", "000123")).toContain("a%2Bb%40example.com");
  });

  it("keeps a leading zero, which is a third of all codes", async () => {
    process.env.PUBLIC_BASE_URL = "https://hub.example.com";
    const { signInLink } = await load();

    expect(signInLink("someone@example.com", "004321")).toContain("c=004321");
  });

  it("refuses plaintext http outside local development", async () => {
    process.env.PUBLIC_BASE_URL = "http://hub.example.com";
    const { signInLink } = await load();

    expect(() => signInLink("someone@example.com", "123456")).toThrow(/https/);
  });

  it("allows http on localhost so local sign-in still works", async () => {
    process.env.PUBLIC_BASE_URL = "http://localhost:3000";
    const { signInLink } = await load();

    expect(signInLink("someone@example.com", "123456")).toContain(
      "http://localhost:3000/signin#",
    );
  });

  it("throws when unset rather than guessing an origin", async () => {
    delete process.env.PUBLIC_BASE_URL;
    const { signInLink } = await load();

    expect(() => signInLink("someone@example.com", "123456")).toThrow(/PUBLIC_BASE_URL/);
  });
});

describe("signInCodeMail", () => {
  it("leads with the code and keeps it the only number, for Apple's scanner", async () => {
    const { signInCodeMail } = await import("@/lib/auth/mailer");
    const mail = signInCodeMail("someone@example.com", "123456");

    expect(mail.subject).toBe("123456 is your TAG Hub verification code");
    expect(mail.text.split("\n")[0]).toBe("Your TAG Hub verification code is 123456");
    // Any other number in the body is what stops the code being recognised.
    expect(mail.text.replace(/123456/g, "")).not.toMatch(/\d/);
  });

  it("carries an HTML alternative and the link when one is supplied", async () => {
    const { signInCodeMail } = await import("@/lib/auth/mailer");
    const link = "https://hub.example.com/signin#e=a%40b.com&c=123456";
    const mail = signInCodeMail("a@b.com", "123456", link);

    expect(mail.text).toContain(link);
    expect(mail.html).toContain(link);
    expect(mail.html).toContain("Click here to sign in");
  });

  it("stays plain text when no link is available, so the code still sends", async () => {
    const { signInCodeMail } = await import("@/lib/auth/mailer");
    const mail = signInCodeMail("a@b.com", "123456");

    expect(mail.html).toBeUndefined();
    expect(mail.text).toContain("123456");
  });
});
