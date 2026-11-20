/**
 * The finding library. Every entry carries a CVSS 3.1 vector rather than a
 * bare score, so its severity is computed by the same rule as any finding and
 * cannot drift from its score. `library.test.ts` checks every vector.
 */

export const LIBRARY_CATEGORIES = [
  "Injection",
  "Cross-site scripting",
  "Access control",
  "Authentication",
  "Cryptography",
  "SSRF",
  "Configuration",
  "Information disclosure",
  "Business logic",
  "API",
  "Client-side",
  "Transport security",
  "Infrastructure",
  "Cloud",
  "Mobile",
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

export interface LibraryEntry {
  id: string;
  title: string;
  category: LibraryCategory;
  cwe: string;
  owasp: string;
  vector: string;
  tags: string[];
  description: string;
  impact: string;
  remediation: string;
  references: string;
}

/**
 * The finding document a template starts from. "Steps to reproduce" is left
 * for the tester, since only they know the exact requests.
 */
export function libraryBody(entry: LibraryEntry): string {
  return `## Description

${entry.description.trim()}

## Impact

${entry.impact.trim()}

## Steps to reproduce

1. 

## Remediation

${entry.remediation.trim()}

## References

${entry.references.trim()}
`;
}

const OWASP_TOP10 = {
  A01: "A01:2021 Broken Access Control",
  A02: "A02:2021 Cryptographic Failures",
  A03: "A03:2021 Injection",
  A04: "A04:2021 Insecure Design",
  A05: "A05:2021 Security Misconfiguration",
  A06: "A06:2021 Vulnerable and Outdated Components",
  A07: "A07:2021 Identification and Authentication Failures",
  A09: "A09:2021 Security Logging and Monitoring Failures",
  A10: "A10:2021 Server-Side Request Forgery",
} as const;

const cwe = (id: number) => `CWE-${id}`;
const cweLink = (id: number, name: string) =>
  `- [CWE-${id}: ${name}](https://cwe.mitre.org/data/definitions/${id}.html)`;

export const LIBRARY: LibraryEntry[] = [
  // Injection
  {
    id: "sqli",
    title: "SQL injection",
    category: "Injection",
    cwe: cwe(89),
    owasp: OWASP_TOP10.A03,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    tags: ["sql", "database", "union", "blind", "time-based"],
    description:
      "The application builds SQL statements by concatenating user-controlled input into the query text. Input supplied to the affected parameter is interpreted by the database as SQL syntax rather than as a value.\n\nDuring testing, payloads that altered the structure of the query changed the application's response, confirming that the database executes attacker-supplied SQL.",
    impact:
      "An unauthenticated attacker can read any data the application's database account can access, including credentials and personal data. Depending on the database and its privileges, the attacker may also modify or delete records, and in some configurations execute operating system commands on the database server.",
    remediation:
      "- Use parameterised queries (prepared statements) for every database call. Never build SQL by string concatenation.\n- Where an ORM is used, avoid raw query helpers that accept interpolated strings.\n- Validate input against an allow list where the expected format is known, such as numeric IDs or sort columns.\n- Run the application with a least-privilege database account that cannot read unrelated schemas or execute system procedures.",
    references: `${cweLink(89, "Improper Neutralization of Special Elements used in an SQL Command")}\n- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)`,
  },
  {
    id: "nosqli",
    title: "NoSQL injection",
    category: "Injection",
    cwe: cwe(943),
    owasp: OWASP_TOP10.A03,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N",
    tags: ["mongodb", "operator", "nosql", "json"],
    description:
      "The application passes user-supplied JSON structures directly into NoSQL query filters. Query operators such as `$ne`, `$gt` or `$regex` supplied in the request are evaluated by the database instead of being treated as literal values.",
    impact:
      "An attacker can change the logic of database queries to bypass authentication checks, enumerate records or extract data one character at a time using regular-expression operators.",
    remediation:
      "- Reject request values that are objects where a scalar is expected; enforce types with a schema validator.\n- Strip or reject keys beginning with `$` in user input before it reaches a query.\n- Use the driver's typed query builders rather than passing request bodies straight through.",
    references: `${cweLink(943, "Improper Neutralization of Special Elements in Data Query Logic")}\n- [OWASP Web Security Testing Guide: Testing for NoSQL Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05.6-Testing_for_NoSQL_Injection)`,
  },
  {
    id: "cmdi",
    title: "OS command injection",
    category: "Injection",
    cwe: cwe(78),
    owasp: OWASP_TOP10.A03,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    tags: ["rce", "shell", "command", "exec"],
    description:
      "User input is passed to a system shell as part of a command line. Shell metacharacters such as `;`, `|`, `$()` and backticks are not neutralised, so an attacker can append arbitrary commands that run with the privileges of the application process.",
    impact:
      "An attacker gains remote code execution on the server. This typically leads to full compromise of the host, access to secrets and credentials stored on it, and a foothold for moving further into the internal network.",
    remediation:
      "- Avoid invoking a shell. Call the required functionality through a library API, or execute the binary directly with an argument array so no shell parses the input.\n- Where a command must be built, validate input against a strict allow list of expected values.\n- Run the service as a low-privilege user inside a restricted container or sandbox.",
    references: `${cweLink(78, "Improper Neutralization of Special Elements used in an OS Command")}\n- [OWASP OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)`,
  },
  {
    id: "ssti",
    title: "Server-side template injection",
    category: "Injection",
    cwe: cwe(1336),
    owasp: OWASP_TOP10.A03,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    tags: ["template", "jinja", "twig", "freemarker", "rce"],
    description:
      "User input is embedded into a server-side template before the template is rendered, rather than being passed to it as data. Template expressions in the input, such as `{{7*7}}`, are evaluated by the template engine.",
    impact:
      "Most template engines expose objects that allow reading files or executing code. An attacker can usually escalate template evaluation to remote code execution on the server.",
    remediation:
      "- Never build templates from user input. Pass user data to fixed templates as context variables.\n- If users must author templates, use a logic-less engine or the engine's sandboxed mode, and keep it patched.\n- Run the rendering service with minimal privileges.",
    references: `${cweLink(1336, "Improper Neutralization of Special Elements Used in a Template Engine")}\n- [PortSwigger: Server-side template injection](https://portswigger.net/web-security/server-side-template-injection)`,
  },
  {
    id: "xxe",
    title: "XML external entity (XXE) injection",
    category: "Injection",
    cwe: cwe(611),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:L",
    tags: ["xml", "dtd", "entity", "file read"],
    description:
      "The application parses XML supplied by the user with a parser that resolves external entities. A document type definition in the request can declare an entity that points to a local file or an internal URL, and the parser fetches it.",
    impact:
      "An attacker can read files from the server, make requests to internal systems (server-side request forgery) and in some parsers cause denial of service through recursive entity expansion.",
    remediation:
      "- Disable DTD processing and external entity resolution in every XML parser the application uses.\n- Prefer simpler data formats such as JSON where XML is not required.\n- Keep XML libraries up to date.",
    references: `${cweLink(611, "Improper Restriction of XML External Entity Reference")}\n- [OWASP XXE Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)`,
  },
  {
    id: "ldapi",
    title: "LDAP injection",
    category: "Injection",
    cwe: cwe(90),
    owasp: OWASP_TOP10.A03,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    tags: ["ldap", "directory", "filter"],
    description:
      "User input is inserted into LDAP search filters without escaping. Characters such as `*`, `(`, `)` and `|` change the structure of the filter.",
    impact:
      "An attacker can alter directory queries to bypass authentication or enumerate users, groups and attributes stored in the directory.",
    remediation:
      "- Escape all user input with the LDAP filter encoding defined in RFC 4515 before building filters.\n- Use the directory library's filter builder rather than string concatenation.\n- Bind with an account that can read only the attributes the application needs.",
    references: `${cweLink(90, "Improper Neutralization of Special Elements used in an LDAP Query")}\n- [OWASP LDAP Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LDAP_Injection_Prevention_Cheat_Sheet.html)`,
  },

  // Cross-site scripting
  {
    id: "xss-reflected",
    title: "Reflected cross-site scripting",
    category: "Cross-site scripting",
    cwe: cwe(79),
    owasp: OWASP_TOP10.A03,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
    tags: ["xss", "javascript", "reflected"],
    description:
      "A request parameter is written back into the HTML response without context-appropriate encoding. A crafted link containing script causes that script to run in the victim's browser in the context of the application's origin.",
    impact:
      "An attacker who persuades a user to open a crafted link can act as that user within the application: read data shown to them, perform actions on their behalf and, where session cookies are not `HttpOnly`, steal their session.",
    remediation:
      "- Encode output for the context it is written into (HTML body, attribute, JavaScript, URL). Use a templating engine that encodes by default.\n- Avoid inserting untrusted data into script blocks or event handler attributes.\n- Deploy a strict Content Security Policy that blocks inline script as a second layer of defence.",
    references: `${cweLink(79, "Improper Neutralization of Input During Web Page Generation")}\n- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)`,
  },
  {
    id: "xss-stored",
    title: "Stored cross-site scripting",
    category: "Cross-site scripting",
    cwe: cwe(79),
    owasp: OWASP_TOP10.A03,
    vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:N",
    tags: ["xss", "persistent", "stored", "javascript"],
    description:
      "Content submitted by one user is stored by the application and later rendered to other users without encoding. Script embedded in the stored content runs in the browser of every user who views it.",
    impact:
      "The payload runs for every visitor of the affected page, including administrators, without any further action by the attacker. This allows mass account takeover, data theft and actions performed with the victims' privileges.",
    remediation:
      "- Encode stored data on output for the context it is rendered in.\n- Where rich text is a feature, sanitise it on input with a maintained HTML sanitiser and an allow list of tags and attributes.\n- Deploy a strict Content Security Policy.",
    references: `${cweLink(79, "Improper Neutralization of Input During Web Page Generation")}\n- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)`,
  },
  {
    id: "xss-dom",
    title: "DOM-based cross-site scripting",
    category: "Cross-site scripting",
    cwe: cwe(79),
    owasp: OWASP_TOP10.A03,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
    tags: ["xss", "dom", "client-side", "innerhtml"],
    description:
      "Client-side JavaScript reads attacker-controllable data, such as `location.hash` or `postMessage` data, and passes it to a dangerous sink such as `innerHTML`, `document.write` or `eval` without sanitisation.",
    impact:
      "An attacker can execute script in a victim's browser in the application's origin by sending a crafted link, with the same consequences as reflected cross-site scripting. The payload may never reach the server, so server-side filters do not see it.",
    remediation:
      "- Use safe DOM APIs such as `textContent` and `setAttribute` instead of HTML-parsing sinks.\n- Sanitise any HTML that must be inserted with a maintained sanitiser.\n- Enable Trusted Types through Content Security Policy to block unsafe sinks.",
    references: `${cweLink(79, "Improper Neutralization of Input During Web Page Generation")}\n- [OWASP DOM based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)`,
  },

  // Access control
  {
    id: "idor",
    title: "Insecure direct object reference",
    category: "Access control",
    cwe: cwe(639),
    owasp: OWASP_TOP10.A01,
    vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
    tags: ["idor", "bola", "authorization", "horizontal"],
    description:
      "The application uses an identifier supplied in the request to look up a record but does not check that the record belongs to the authenticated user. Changing the identifier returns another user's data.",
    impact:
      "Any authenticated user can read records belonging to other users by enumerating identifiers, exposing personal or business data across the whole customer base.",
    remediation:
      "- Enforce an ownership or permission check on the server for every object access, derived from the session rather than from request data.\n- Centralise authorisation logic so every endpoint applies it consistently.\n- Random identifiers make enumeration harder but are not a substitute for an authorisation check.",
    references: `${cweLink(639, "Authorization Bypass Through User-Controlled Key")}\n- [OWASP Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)`,
  },
  {
    id: "privesc-vertical",
    title: "Vertical privilege escalation",
    category: "Access control",
    cwe: cwe(269),
    owasp: OWASP_TOP10.A01,
    vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    tags: ["admin", "authorization", "role", "privilege"],
    description:
      "Administrative functions are protected only by hiding them in the user interface. The server does not verify the caller's role, so a low-privileged user can call administrative endpoints directly.",
    impact:
      "A low-privileged user can perform administrative actions such as managing users, changing configuration or accessing all data, gaining full control of the application.",
    remediation:
      "- Check the caller's role on the server for every privileged endpoint, denying by default.\n- Apply authorisation in shared middleware rather than per handler.\n- Add automated tests that call every privileged endpoint as a low-privileged user.",
    references: `${cweLink(269, "Improper Privilege Management")}\n- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)`,
  },
  {
    id: "path-traversal",
    title: "Path traversal",
    category: "Access control",
    cwe: cwe(22),
    owasp: OWASP_TOP10.A01,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    tags: ["lfi", "directory traversal", "file", "../"],
    description:
      "A file name or path taken from the request is used to read a file from disk without being confined to the intended directory. Sequences such as `../` move outside it.",
    impact:
      "An attacker can read arbitrary files that the application process can access, such as configuration files containing credentials, source code and system files.",
    remediation:
      "- Do not use user input in file paths. Map user-facing identifiers to files on the server instead.\n- If a path must be built, resolve it to its canonical form and verify it is inside the intended base directory before opening it.\n- Run the service with file system permissions limited to what it needs.",
    references: `${cweLink(22, "Improper Limitation of a Pathname to a Restricted Directory")}\n- [OWASP: Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)`,
  },
  {
    id: "cors",
    title: "Permissive cross-origin resource sharing policy",
    category: "Access control",
    cwe: cwe(942),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N",
    tags: ["cors", "origin", "credentials"],
    description:
      "The server reflects the value of the request's `Origin` header in `Access-Control-Allow-Origin` and also sends `Access-Control-Allow-Credentials: true`. Any website can therefore make authenticated cross-origin requests to the application and read the responses.",
    impact:
      "If a logged-in user visits a malicious website, that site can read the user's data from the application's API and perform actions on their behalf.",
    remediation:
      "- Allow only a fixed list of trusted origins, compared exactly. Never reflect the request origin.\n- Do not allow the `null` origin.\n- Send `Access-Control-Allow-Credentials` only where cross-origin authenticated access is required.",
    references: `${cweLink(942, "Permissive Cross-domain Policy with Untrusted Domains")}\n- [PortSwigger: CORS](https://portswigger.net/web-security/cors)`,
  },
  {
    id: "csrf",
    title: "Cross-site request forgery",
    category: "Access control",
    cwe: cwe(352),
    owasp: OWASP_TOP10.A01,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N",
    tags: ["csrf", "xsrf", "samesite", "token"],
    description:
      "State-changing requests are authenticated only by the session cookie, which the browser attaches automatically, and carry no anti-forgery token. Session cookies do not set a restrictive `SameSite` attribute.",
    impact:
      "A malicious website visited by a logged-in user can submit requests to the application on the user's behalf, for example changing their email address or password, leading to account takeover.",
    remediation:
      "- Require a per-session or per-request anti-forgery token on every state-changing request.\n- Set session cookies with `SameSite=Lax` or `Strict`.\n- Require re-authentication for sensitive actions such as changing credentials.",
    references: `${cweLink(352, "Cross-Site Request Forgery")}\n- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)`,
  },
  {
    id: "open-redirect",
    title: "Open redirect",
    category: "Access control",
    cwe: cwe(601),
    owasp: OWASP_TOP10.A01,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
    tags: ["redirect", "phishing", "url"],
    description:
      "The application redirects users to a URL taken from a request parameter without checking that it points to a trusted destination.",
    impact:
      "Attackers can craft links on the application's trusted domain that send users to a malicious site, which makes phishing more convincing. In OAuth flows an open redirect can leak authorisation codes or tokens.",
    remediation:
      "- Redirect only to relative paths, or to destinations on an allow list.\n- Map redirect targets to server-side identifiers instead of accepting URLs.\n- Show an interstitial warning before sending users to an external domain.",
    references: `${cweLink(601, "URL Redirection to Untrusted Site")}\n- [OWASP Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)`,
  },

  // Authentication and session
  {
    id: "no-lockout",
    title: "No protection against password guessing",
    category: "Authentication",
    cwe: cwe(307),
    owasp: OWASP_TOP10.A07,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N",
    tags: ["brute force", "rate limit", "lockout", "credential stuffing"],
    description:
      "The login endpoint accepts an unlimited number of failed attempts for an account and from a single client. No rate limiting, progressive delay, CAPTCHA or account lockout was observed during testing.",
    impact:
      "Attackers can run password guessing and credential stuffing attacks at high speed, which will compromise accounts that use weak or reused passwords.",
    remediation:
      "- Rate limit failed logins per account and per source, with progressive delays.\n- Offer and encourage multi-factor authentication.\n- Check new passwords against lists of breached passwords.\n- Alert on unusual volumes of failed logins.",
    references: `${cweLink(307, "Improper Restriction of Excessive Authentication Attempts")}\n- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)`,
  },
  {
    id: "user-enum",
    title: "Username enumeration",
    category: "Authentication",
    cwe: cwe(204),
    owasp: OWASP_TOP10.A07,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    tags: ["enumeration", "login", "password reset", "registration"],
    description:
      "The login, registration or password reset functions respond differently depending on whether an account exists, through different messages, status codes or response times.",
    impact:
      "An attacker can build a list of valid accounts, which makes password guessing, credential stuffing and targeted phishing more effective.",
    remediation:
      "- Return identical messages, status codes and timing for existing and non-existing accounts.\n- For password reset, always say that an email has been sent if the account exists.\n- Combine with rate limiting on all authentication endpoints.",
    references: `${cweLink(204, "Observable Response Discrepancy")}\n- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)`,
  },
  {
    id: "weak-password-policy",
    title: "Weak password policy",
    category: "Authentication",
    cwe: cwe(521),
    owasp: OWASP_TOP10.A07,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N",
    tags: ["password", "policy", "length"],
    description:
      "The application accepts very short or commonly used passwords, such as `123456` or `password`, and does not check new passwords against known breached passwords.",
    impact:
      "Users can choose passwords that are guessed quickly, which increases the success rate of password guessing and credential stuffing attacks.",
    remediation:
      "- Require a minimum length of at least 8 characters, preferably more, and allow long passphrases.\n- Reject passwords found in breach corpuses and common password lists.\n- Avoid composition rules and forced periodic changes, which push users toward predictable patterns.",
    references: `${cweLink(521, "Weak Password Requirements")}\n- [NIST SP 800-63B: Memorized secrets](https://pages.nist.gov/800-63-4/sp800-63b.html)`,
  },
  {
    id: "session-fixation",
    title: "Session fixation",
    category: "Authentication",
    cwe: cwe(384),
    owasp: OWASP_TOP10.A07,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N",
    tags: ["session", "cookie", "login"],
    description:
      "The session identifier issued before login remains valid after the user authenticates. An identifier planted in the victim's browser therefore becomes an authenticated session that the attacker also knows.",
    impact:
      "An attacker who can set the victim's session identifier can take over the victim's account once they log in.",
    remediation:
      "- Issue a new session identifier on every authentication and privilege change, and invalidate the old one.\n- Do not accept session identifiers from URL parameters.",
    references: `${cweLink(384, "Session Fixation")}\n- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)`,
  },
  {
    id: "session-no-expiry",
    title: "Sessions are not invalidated on logout",
    category: "Authentication",
    cwe: cwe(613),
    owasp: OWASP_TOP10.A07,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N",
    tags: ["session", "logout", "timeout", "token"],
    description:
      "Session tokens remain valid on the server after the user logs out, and sessions have no idle or absolute timeout.",
    impact:
      "A token captured from a shared computer, a log file or a proxy can be reused long after the user believes the session has ended.",
    remediation:
      "- Invalidate the session on the server at logout.\n- Apply an idle timeout and an absolute session lifetime suited to the application's risk.\n- For stateless tokens, keep lifetimes short and support revocation.",
    references: `${cweLink(613, "Insufficient Session Expiration")}\n- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)`,
  },
  {
    id: "jwt-weak",
    title: "JSON Web Tokens signed with a weak secret",
    category: "Authentication",
    cwe: cwe(347),
    owasp: OWASP_TOP10.A02,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
    tags: ["jwt", "hs256", "token", "signature"],
    description:
      "Access tokens are signed with HMAC using a short, guessable secret. The secret was recovered offline from a captured token with a dictionary attack.",
    impact:
      "With the secret, an attacker can forge tokens for any user, including administrators, and fully bypass authentication.",
    remediation:
      "- Rotate the signing key immediately and invalidate existing tokens.\n- Use a randomly generated key of at least 256 bits, stored in a secrets manager, or switch to an asymmetric algorithm such as ES256.\n- Pin the accepted algorithm on the server and reject `none`.",
    references: `${cweLink(347, "Improper Verification of Cryptographic Signature")}\n- [OWASP JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)`,
  },
  {
    id: "default-creds",
    title: "Default credentials",
    category: "Authentication",
    cwe: cwe(1392),
    owasp: OWASP_TOP10.A07,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    tags: ["default password", "admin", "vendor"],
    description:
      "An administrative interface accepts the vendor's documented default username and password.",
    impact:
      "Anyone who knows the product can log in as an administrator and take full control of the system and the data it holds.",
    remediation:
      "- Change all default credentials before deployment and use unique, strong passwords.\n- Restrict administrative interfaces to a management network or VPN.\n- Add a check for default credentials to the deployment process.",
    references: `${cweLink(1392, "Use of Default Credentials")}`,
  },
  {
    id: "mfa-bypass",
    title: "Multi-factor authentication can be bypassed",
    category: "Authentication",
    cwe: cwe(287),
    owasp: OWASP_TOP10.A07,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N",
    tags: ["mfa", "2fa", "otp", "bypass"],
    description:
      "After the password step, the application issues a session that can already reach authenticated pages before the second factor is verified. Skipping the verification request grants access.",
    impact:
      "An attacker who knows or guesses a user's password can access the account without the second factor, removing the protection MFA is meant to provide.",
    remediation:
      "- Track MFA completion as session state and enforce it on every authenticated route.\n- Issue the fully authenticated session only after the second factor succeeds.\n- Rate limit one-time code attempts.",
    references: `${cweLink(287, "Improper Authentication")}\n- [OWASP Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)`,
  },

  // Cryptography
  {
    id: "weak-hashing",
    title: "Passwords stored with a fast hash",
    category: "Cryptography",
    cwe: cwe(916),
    owasp: OWASP_TOP10.A02,
    vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:N/A:N",
    tags: ["md5", "sha1", "bcrypt", "argon2", "password storage"],
    description:
      "User passwords are stored as unsalted or salted hashes from a fast general-purpose algorithm such as MD5 or SHA-1.",
    impact:
      "If the database is ever exposed, most passwords can be recovered quickly with commodity hardware, and reused passwords put users' other accounts at risk.",
    remediation:
      "- Store passwords with a slow, memory-hard algorithm: Argon2id, scrypt or bcrypt with an appropriate cost.\n- Rehash existing passwords on each user's next successful login.",
    references: `${cweLink(916, "Use of Password Hash With Insufficient Computational Effort")}\n- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)`,
  },
  {
    id: "hardcoded-secret",
    title: "Hard-coded secret in client-side code",
    category: "Cryptography",
    cwe: cwe(798),
    owasp: OWASP_TOP10.A07,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N",
    tags: ["api key", "secret", "javascript", "token"],
    description:
      "A credential for a back-end service is embedded in JavaScript or a mobile application bundle that is delivered to every user.",
    impact:
      "Anyone can extract the credential and use it to call the service directly, with whatever access the credential grants.",
    remediation:
      "- Revoke and rotate the exposed credential.\n- Keep secrets on the server and proxy requests that need them.\n- Add secret scanning to the build pipeline.",
    references: `${cweLink(798, "Use of Hard-coded Credentials")}`,
  },

  // SSRF
  {
    id: "ssrf",
    title: "SSRF",
    category: "SSRF",
    cwe: cwe(918),
    owasp: OWASP_TOP10.A10,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N",
    tags: ["ssrf", "metadata", "internal", "url fetch"],
    description:
      "The application fetches a URL supplied by the user from the server side without restricting the destination. Requests can be directed at internal addresses, including the cloud instance metadata service.",
    impact:
      "An attacker can reach internal services that are not exposed to the internet, read cloud credentials from the metadata service and use them to access other cloud resources.",
    remediation:
      "- Fetch only from an allow list of hosts and schemes where possible.\n- Resolve the destination and block private, loopback and link-local ranges, checking again after redirects.\n- Enforce IMDSv2 on cloud instances and restrict egress at the network layer.",
    references: `${cweLink(918, "Server-Side Request Forgery")}\n- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)`,
  },

  // Configuration
  {
    id: "debug-mode",
    title: "Debug mode enabled in production",
    category: "Configuration",
    cwe: cwe(489),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    tags: ["debug", "stack trace", "framework"],
    description:
      "The application runs with its framework's debug mode enabled. Errors produce detailed debug pages showing source code, configuration and environment variables.",
    impact:
      "Attackers learn internal paths, library versions and sometimes secrets, which makes further attacks easier. Some debug consoles also allow code execution.",
    remediation:
      "- Disable debug mode in production through deployment configuration.\n- Return generic error pages and log details on the server.\n- Add a deployment check that fails when debug mode is on.",
    references: `${cweLink(489, "Active Debug Code")}`,
  },
  {
    id: "directory-listing",
    title: "Directory listing enabled",
    category: "Configuration",
    cwe: cwe(548),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    tags: ["directory", "index", "web server"],
    description:
      "The web server returns an index of files for directories that have no default document.",
    impact:
      "Attackers can browse files that were not meant to be linked, such as backups, logs and configuration files.",
    remediation:
      "- Disable automatic directory indexes in the web server configuration.\n- Remove files from the web root that should not be served.",
    references: `${cweLink(548, "Exposure of Information Through Directory Listing")}`,
  },
  {
    id: "security-headers",
    title: "Missing HTTP security headers",
    category: "Configuration",
    cwe: cwe(693),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:L/A:N",
    tags: ["csp", "x-frame-options", "headers", "hardening"],
    description:
      "Responses do not include headers that enable browser security features, such as `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` and a framing policy.",
    impact:
      "On its own this is not exploitable, but it removes defence-in-depth controls that would limit the impact of other flaws such as cross-site scripting or clickjacking.",
    remediation:
      "- Set `Content-Security-Policy` with a restrictive policy, including `frame-ancestors`.\n- Set `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.\n- Configure the headers centrally in the web server or framework.",
    references:
      "- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)",
  },
  {
    id: "cookie-flags",
    title: "Session cookie without security attributes",
    category: "Configuration",
    cwe: cwe(614),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N",
    tags: ["cookie", "httponly", "secure", "samesite"],
    description:
      "The session cookie is set without one or more of the `Secure`, `HttpOnly` and `SameSite` attributes.",
    impact:
      "Without `Secure` the cookie can be sent over unencrypted connections; without `HttpOnly` it can be read by injected script; without `SameSite` it is sent on cross-site requests, enabling CSRF.",
    remediation:
      "- Set `Secure`, `HttpOnly` and `SameSite=Lax` (or `Strict`) on all session cookies.\n- Consider the `__Host-` cookie prefix.",
    references: `${cweLink(614, "Sensitive Cookie in HTTPS Session Without 'Secure' Attribute")}`,
  },
  {
    id: "outdated-component",
    title: "Component with known vulnerabilities",
    category: "Configuration",
    cwe: cwe(1104),
    owasp: OWASP_TOP10.A06,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
    tags: ["outdated", "cve", "patch", "library", "version"],
    description:
      "The system runs a version of a software component that is affected by publicly documented vulnerabilities. Replace this paragraph with the component, the version found and the relevant CVE identifiers.",
    impact:
      "Public vulnerabilities often have published exploits. The impact depends on the specific vulnerabilities and ranges up to remote code execution; adjust the CVSS vector to the most severe applicable issue.",
    remediation:
      "- Upgrade the component to a supported version that fixes the listed vulnerabilities.\n- Maintain an inventory of components and subscribe to their security advisories.\n- Add dependency scanning to the build pipeline.",
    references: `${cweLink(1104, "Use of Unmaintained Third Party Components")}`,
  },

  // Information disclosure
  {
    id: "verbose-errors",
    title: "Verbose error messages",
    category: "Information disclosure",
    cwe: cwe(209),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
    tags: ["stack trace", "error", "exception"],
    description:
      "Malformed requests cause the application to return detailed error messages including stack traces, file paths, query fragments or library versions.",
    impact:
      "The details help attackers map the technology stack and refine attacks such as injection.",
    remediation:
      "- Return generic error messages with a correlation ID and log details on the server.\n- Handle exceptions in one global handler.",
    references: `${cweLink(209, "Generation of Error Message Containing Sensitive Information")}`,
  },
  {
    id: "version-disclosure",
    title: "Software version disclosure",
    category: "Information disclosure",
    cwe: cwe(200),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
    tags: ["banner", "server header", "x-powered-by", "fingerprint"],
    description:
      "Response headers such as `Server` and `X-Powered-By`, or default pages, reveal the exact names and versions of server software.",
    impact:
      "Attackers can quickly match versions to known vulnerabilities. The disclosure itself grants no access.",
    remediation:
      "- Remove or genericise version banners in server and framework configuration.\n- Keep software patched, which matters more than hiding versions.",
    references: `${cweLink(200, "Exposure of Sensitive Information to an Unauthorized Actor")}`,
  },
  {
    id: "exposed-git",
    title: "Source code repository exposed",
    category: "Information disclosure",
    cwe: cwe(527),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    tags: ["git", ".git", "source code", "backup"],
    description:
      "The `.git` directory is reachable over HTTP in the web root, allowing the repository, including its history, to be downloaded.",
    impact:
      "Attackers obtain the application's source code and any secrets ever committed to it, which often includes credentials and keys.",
    remediation:
      "- Block access to `.git` and other dot-directories in the web server configuration.\n- Deploy build artefacts rather than working copies.\n- Rotate any secrets present in the repository history.",
    references: `${cweLink(527, "Exposure of Version-Control Repository to an Unauthorized Control Sphere")}`,
  },

  // Business logic
  {
    id: "race-condition",
    title: "Race condition in a limited action",
    category: "Business logic",
    cwe: cwe(362),
    owasp: OWASP_TOP10.A04,
    vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N",
    tags: ["race", "toctou", "concurrency", "coupon", "limit"],
    description:
      "An action that should succeed only once, such as redeeming a voucher or withdrawing a balance, checks the limit and then updates state in separate steps. Sending many requests in parallel lets several pass the check before any update is written.",
    impact:
      "An attacker can exceed business limits, for example redeeming a single-use voucher many times or spending more than their balance, causing direct financial loss.",
    remediation:
      "- Perform the check and the update atomically, using database constraints, row locks or conditional updates.\n- Use idempotency keys for sensitive operations.",
    references: `${cweLink(362, "Concurrent Execution using Shared Resource with Improper Synchronization")}`,
  },
  {
    id: "price-tampering",
    title: "Client-controlled price or quantity",
    category: "Business logic",
    cwe: cwe(602),
    owasp: OWASP_TOP10.A04,
    vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N",
    tags: ["price", "cart", "checkout", "negative quantity"],
    description:
      "The checkout process trusts the price, discount or quantity values sent by the client. Modified values, including negative quantities, are accepted and charged.",
    impact:
      "Attackers can buy goods or services for less than their price, or generate credits, causing direct financial loss.",
    remediation:
      "- Compute prices, discounts and totals on the server from authoritative data.\n- Validate quantities as positive integers within business limits.",
    references: `${cweLink(602, "Client-Side Enforcement of Server-Side Security")}`,
  },

  // API
  {
    id: "mass-assignment",
    title: "Mass assignment",
    category: "API",
    cwe: cwe(915),
    owasp: OWASP_TOP10.A01,
    vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N",
    tags: ["api", "mass assignment", "role", "object binding"],
    description:
      "The API binds request bodies directly onto internal objects. Adding properties that the client should not control, such as `role` or `isAdmin`, changes them.",
    impact:
      "Users can modify protected attributes of their own records, including escalating their privileges.",
    remediation:
      "- Bind only an explicit allow list of fields for each endpoint, using dedicated input types.\n- Reject unknown properties.",
    references: `${cweLink(915, "Improperly Controlled Modification of Dynamically-Determined Object Attributes")}\n- [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)`,
  },
  {
    id: "excessive-data",
    title: "Excessive data exposure in API responses",
    category: "API",
    cwe: cwe(213),
    owasp: OWASP_TOP10.A01,
    vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N",
    tags: ["api", "over-fetching", "pii", "serialization"],
    description:
      "API responses return complete internal objects, including fields the client does not display, such as other users' email addresses, internal flags or hashes. Filtering happens only in the front end.",
    impact:
      "Anyone who inspects the API traffic can read the extra data, which may include personal or security-sensitive information.",
    remediation:
      "- Define response schemas per endpoint and serialise only the fields the client needs.\n- Review responses for sensitive fields in automated tests.",
    references: `${cweLink(213, "Exposure of Sensitive Information Due to Incompatible Policies")}`,
  },
  {
    id: "no-rate-limit",
    title: "No rate limiting on resource-intensive endpoints",
    category: "API",
    cwe: cwe(770),
    owasp: OWASP_TOP10.A04,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L",
    tags: ["rate limit", "dos", "throttling", "cost"],
    description:
      "Endpoints that are expensive to serve, such as search, export or messaging, accept unlimited requests from a single client.",
    impact:
      "An attacker can degrade service for other users, run up infrastructure or third-party costs (for example SMS or email sending) and scrape data at scale.",
    remediation:
      "- Apply rate limits per user and per source address, stricter on expensive operations.\n- Enforce pagination limits and request size limits.",
    references: `${cweLink(770, "Allocation of Resources Without Limits or Throttling")}`,
  },

  // Client-side
  {
    id: "clickjacking",
    title: "Clickjacking",
    category: "Client-side",
    cwe: cwe(1021),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N",
    tags: ["framing", "ui redress", "x-frame-options"],
    description:
      "Pages that perform sensitive actions can be embedded in a frame on another origin, because the application sends neither `X-Frame-Options` nor a `frame-ancestors` directive.",
    impact:
      "An attacker can overlay the framed page with a decoy and trick users into clicking buttons that perform actions in the application.",
    remediation:
      "- Send `Content-Security-Policy: frame-ancestors 'none'` (or `'self'`), and `X-Frame-Options: DENY` for older browsers.",
    references: `${cweLink(1021, "Improper Restriction of Rendered UI Layers or Frames")}`,
  },

  // Transport security
  {
    id: "no-hsts",
    title: "HTTP Strict Transport Security not enforced",
    category: "Transport security",
    cwe: cwe(319),
    owasp: OWASP_TOP10.A02,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
    tags: ["hsts", "tls", "downgrade", "ssl stripping"],
    description:
      "The site does not send the `Strict-Transport-Security` header, so browsers will make an initial plain HTTP request when users type the address or follow an HTTP link.",
    impact:
      "An attacker on the network path can intercept that first request and keep the user on an unencrypted connection (SSL stripping), exposing credentials and session data.",
    remediation:
      "- Send `Strict-Transport-Security: max-age=31536000; includeSubDomains` on all HTTPS responses.\n- Once all subdomains support HTTPS, consider HSTS preloading.",
    references:
      "- [OWASP HTTP Strict Transport Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html)",
  },
  {
    id: "weak-tls",
    title: "Deprecated TLS protocols or weak cipher suites",
    category: "Transport security",
    cwe: cwe(327),
    owasp: OWASP_TOP10.A02,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
    tags: ["tls 1.0", "tls 1.1", "cipher", "ssl"],
    description:
      "The service accepts TLS 1.0 or 1.1, or negotiates cipher suites without forward secrecy or with weak algorithms such as 3DES or RC4.",
    impact:
      "Connections from clients that negotiate the weak options are easier to attack, which weakens the confidentiality of traffic in transit.",
    remediation:
      "- Support only TLS 1.2 and 1.3.\n- Allow only AEAD cipher suites with forward secrecy.\n- Use a current configuration generator, such as Mozilla's, as a baseline.",
    references: `${cweLink(327, "Use of a Broken or Risky Cryptographic Algorithm")}\n- [Mozilla Server Side TLS](https://wiki.mozilla.org/Security/Server_Side_TLS)`,
  },
  {
    id: "expired-cert",
    title: "Invalid or expired TLS certificate",
    category: "Transport security",
    cwe: cwe(295),
    owasp: OWASP_TOP10.A02,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N",
    tags: ["certificate", "expired", "self-signed", "tls"],
    description:
      "The service presents a certificate that is expired, self-signed or issued for a different host name, so browsers show a security warning.",
    impact:
      "Users learn to click through certificate warnings, which makes a real man-in-the-middle attack indistinguishable from normal operation.",
    remediation:
      "- Install a valid certificate from a trusted authority for every host name served.\n- Automate renewal, for example with ACME, and monitor expiry dates.",
    references: `${cweLink(295, "Improper Certificate Validation")}`,
  },

  // Infrastructure
  {
    id: "exposed-admin-service",
    title: "Management service exposed to the internet",
    category: "Infrastructure",
    cwe: cwe(284),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
    tags: ["rdp", "ssh", "database", "port", "firewall"],
    description:
      "A management or database service, such as RDP, SSH, a database port or an administrative web console, is reachable from the internet.",
    impact:
      "The service is exposed to continuous password guessing and to any future vulnerability in it. Compromise gives direct access to the host or its data.",
    remediation:
      "- Restrict management services to a VPN or a bastion host with firewall rules.\n- Require strong authentication and keep the services patched.",
    references: `${cweLink(284, "Improper Access Control")}`,
  },
  {
    id: "smb-signing",
    title: "SMB signing not required",
    category: "Infrastructure",
    cwe: cwe(294),
    owasp: OWASP_TOP10.A05,
    vector: "CVSS:3.1/AV:A/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N",
    tags: ["smb", "ntlm relay", "active directory", "windows"],
    description: "Hosts on the internal network do not require SMB message signing.",
    impact:
      "An attacker on the internal network can relay captured NTLM authentication to these hosts and execute commands as the relayed user, a common path to domain compromise.",
    remediation:
      "- Require SMB signing on all servers and workstations through Group Policy.\n- Disable NTLM where possible, and LLMNR and NBT-NS, which are used to capture authentication.",
    references: `${cweLink(294, "Authentication Bypass by Capture-replay")}`,
  },

  // Cloud
  {
    id: "public-bucket",
    title: "Publicly accessible storage bucket",
    category: "Cloud",
    cwe: cwe(732),
    owasp: OWASP_TOP10.A01,
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    tags: ["s3", "blob", "gcs", "bucket", "storage"],
    description: "A cloud storage bucket allows anonymous listing and reading of its objects.",
    impact:
      "Anyone can download the bucket's contents. If write access is also public, attackers can replace files served to users.",
    remediation:
      "- Remove public access and enable the provider's account-level public access block.\n- Serve public content through a CDN with an origin access identity.\n- Review bucket policies with automated configuration scanning.",
    references: `${cweLink(732, "Incorrect Permission Assignment for Critical Resource")}`,
  },
  {
    id: "iam-overprivileged",
    title: "Overprivileged cloud identity",
    category: "Cloud",
    cwe: cwe(250),
    owasp: OWASP_TOP10.A01,
    vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:C/C:H/I:H/A:H",
    tags: ["iam", "role", "policy", "least privilege", "aws", "azure"],
    description:
      "A role attached to a workload has administrative or wildcard permissions far beyond what the workload uses.",
    impact:
      "Any compromise of the workload, for example through SSRF or code execution, becomes a compromise of the whole cloud account.",
    remediation:
      "- Replace wildcard policies with least-privilege policies scoped to the resources and actions used.\n- Use access analysis tooling to generate policies from observed usage.",
    references: `${cweLink(250, "Execution with Unnecessary Privileges")}`,
  },

  // Mobile
  {
    id: "mobile-insecure-storage",
    title: "Sensitive data stored insecurely on the device",
    category: "Mobile",
    cwe: cwe(922),
    owasp: "OWASP MASVS-STORAGE",
    vector: "CVSS:3.1/AV:P/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    tags: ["mobile", "android", "ios", "shared preferences", "keychain"],
    description:
      "The application stores tokens or personal data in plaintext files, shared preferences or an unencrypted database on the device.",
    impact:
      "Anyone with access to the device, a backup of it or malware on it can read the data and reuse the tokens.",
    remediation:
      "- Store secrets in the Android Keystore or iOS Keychain.\n- Encrypt sensitive local data and exclude it from backups.\n- Store as little as possible on the device.",
    references: `${cweLink(922, "Insecure Storage of Sensitive Information")}\n- [OWASP MASVS](https://mas.owasp.org/MASVS/)`,
  },
  {
    id: "mobile-no-pinning",
    title: "TLS certificate pinning not implemented",
    category: "Mobile",
    cwe: cwe(295),
    owasp: "OWASP MASVS-NETWORK",
    vector: "CVSS:3.1/AV:A/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N",
    tags: ["mobile", "pinning", "mitm", "tls"],
    description:
      "The mobile application trusts any certificate signed by a certificate authority in the device trust store, including user-installed ones.",
    impact:
      "An attacker who can get a certificate trusted on the device, or a malicious network operator, can intercept and modify the application's traffic.",
    remediation:
      "- Pin the server's public key or an intermediate certificate, with a backup pin.\n- On Android, use a network security configuration that does not trust user certificates.",
    references: `${cweLink(295, "Improper Certificate Validation")}\n- [OWASP MASVS](https://mas.owasp.org/MASVS/)`,
  },
  {
    id: "insufficient-logging",
    title: "Security events are not logged",
    category: "Configuration",
    cwe: cwe(778),
    owasp: OWASP_TOP10.A09,
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N",
    tags: ["logging", "monitoring", "audit", "detection"],
    description:
      "Failed logins, access-control failures and administrative actions are not recorded, or are recorded without the user, time and source needed to investigate them.",
    impact: "Attacks go unnoticed and incidents cannot be reconstructed afterwards.",
    remediation:
      "- Log authentication events, authorisation failures and administrative changes with user, time and source.\n- Forward logs to a central, tamper-resistant store and alert on suspicious patterns.",
    references: `${cweLink(778, "Insufficient Logging")}\n- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)`,
  },
];
